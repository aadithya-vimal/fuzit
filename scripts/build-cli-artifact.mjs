import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");

function writeString(buffer, offset, length, value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`tar field too long: ${value}`);
  bytes.copy(buffer, offset);
}

function writeOctal(buffer, offset, length, value) {
  writeString(
    buffer,
    offset,
    length,
    `${value.toString(8).padStart(length - 1, "0")}\0`,
  );
}

function tarHeader(path, size, mode) {
  if (
    path.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.includes("..")
  )
    throw new Error(`unsafe artifact path: ${path}`);
  const header = Buffer.alloc(512);
  writeString(header, 0, 100, path);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeString(header, 265, 32, "root");
  writeString(header, 297, 32, "root");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

export function createCanonicalTarGzip(entries) {
  const chunks = [];
  for (const entry of [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const mode = entry.path === "package/bin/fuzit.mjs" ? 0o755 : 0o644;
    chunks.push(tarHeader(entry.path, entry.bytes.length, mode), entry.bytes);
    const padding = (512 - (entry.bytes.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
}

async function collectFiles(directory) {
  const entries = [];
  async function visit(current) {
    for (const item of (await readdir(current, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const absolute = join(current, item.name);
      if (item.isDirectory()) await visit(absolute);
      else if (item.isFile()) {
        let bytes = await readFile(absolute);
        if (item.name === "package.json") {
          const sortObject = (value) => {
            if (Array.isArray(value)) return value.map(sortObject);
            if (value !== null && typeof value === "object")
              return Object.fromEntries(
                Object.entries(value)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([key, child]) => [key, sortObject(child)]),
              );
            return value;
          };
          bytes = Buffer.from(
            `${JSON.stringify(sortObject(JSON.parse(bytes)), null, 2)}\n`,
          );
        }
        entries.push({
          path: `package/${relative(directory, absolute).split(sep).join("/")}`,
          bytes,
        });
      } else throw new Error(`unsupported artifact entry: ${absolute}`);
    }
  }
  await visit(directory);
  return entries;
}

function run(command, arguments_, cwd) {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    );
  return result.stdout;
}

export async function buildPrivateCliArtifact(outputDirectory) {
  if (!process.env.npm_execpath)
    throw new Error("npm_execpath is required; run through pnpm artifacts:cli");
  const temporary = await mkdtemp(join(tmpdir(), "fuzit-v1-132-"));
  try {
    const packed = join(temporary, "packed");
    const extracted = join(temporary, "extracted");
    await mkdir(packed);
    await mkdir(extracted);
    run(
      process.execPath,
      [
        process.env.npm_execpath,
        "--dir",
        "apps/cli",
        "pack",
        "--pack-destination",
        packed,
      ],
      root,
    );
    const tarballName = (await readdir(packed)).find((path) =>
      path.endsWith(".tgz"),
    );
    if (!tarballName) throw new Error("pnpm did not produce a CLI tarball");
    run("tar", ["-xf", join(packed, tarballName), "-C", extracted], root);
    const entries = await collectFiles(join(extracted, "package"));
    const bytes = createCanonicalTarGzip(entries);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const target = resolve(outputDirectory);
    await mkdir(target, { recursive: true });
    await writeFile(join(target, tarballName), bytes);
    const manifest = {
      schemaVersion: 1,
      artifact: tarballName,
      sha256,
      bytes: bytes.length,
      sourceCommit: run("git", ["rev-parse", "HEAD"], root).trim(),
      package: "fuzit",
      version: "0.0.1",
      entries: entries.map(({ path, bytes: content }) => ({
        path,
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      })),
      publication: "none",
    };
    await writeFile(
      join(target, "fuzit-cli.manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return { output: target, manifest };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const output =
    process.env.FUZIT_ARTIFACT_OUTPUT ?? join(root, "artifacts", "local", "v1");
  const result = await buildPrivateCliArtifact(output);
  process.stdout.write(
    `${JSON.stringify({ output: result.output, artifact: result.manifest.artifact, sha256: result.manifest.sha256, publication: "none" })}\n`,
  );
}
