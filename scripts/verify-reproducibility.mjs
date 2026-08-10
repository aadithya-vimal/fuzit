import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { auditVsixPackage } from "./verify-vsix.mjs";

const root = resolve(".");

function runPnpm(args) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, ...args],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
    },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function canonicalTarHash(path) {
  const listed = spawnSync("tar", ["-tf", path], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (listed.status !== 0) throw new Error(listed.stderr || listed.stdout);
  const hash = createHash("sha256");
  for (const entry of listed.stdout.split(/\r?\n/).filter(Boolean).sort()) {
    const extracted = spawnSync("tar", ["-xOf", path, entry], {
      cwd: root,
      shell: false,
      encoding: null,
    });
    if (extracted.status !== 0) throw new Error(String(extracted.stderr));
    let content = extracted.stdout;
    if (entry.endsWith("package.json")) {
      const sortJson = (value) =>
        Array.isArray(value)
          ? value.map(sortJson)
          : value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([key, child]) => [key, sortJson(child)]),
              )
            : value;
      content = Buffer.from(
        JSON.stringify(sortJson(JSON.parse(content.toString("utf8")))),
      );
    }
    hash.update(entry).update("\0").update(content);
  }
  return hash.digest("hex");
}

async function buildArtifactSet(output) {
  await mkdir(output);
  runPnpm(["build", "--force"]);
  for (const directory of [
    "apps/cli",
    "apps/mcp-server",
    "packages/plugin-sdk",
  ]) {
    runPnpm(["--dir", directory, "pack", "--pack-destination", output]);
  }
  const artifacts = [];
  for (const path of (await readdir(output)).sort()) {
    const bytes = await readFile(join(output, path));
    artifacts.push({
      path,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      canonicalSha256: canonicalTarHash(join(output, path)),
    });
  }
  const vsix = await auditVsixPackage();
  artifacts.push({ path: "fuzit.vsix", bytes: null, sha256: vsix.sha256 });
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}

export function compareArtifactSets(first, second) {
  const differences = [];
  const permittedDifferences = [];
  const paths = new Set([...first, ...second].map(({ path }) => path));
  for (const path of [...paths].sort()) {
    const left = first.find((artifact) => artifact.path === path);
    const right = second.find((artifact) => artifact.path === path);
    if (!left || !right) {
      differences.push({ path, first: left ?? null, second: right ?? null });
    } else if (left.sha256 !== right.sha256 || left.bytes !== right.bytes) {
      if (
        path.endsWith(".tgz") &&
        left.canonicalSha256 &&
        left.canonicalSha256 === right.canonicalSha256
      ) {
        permittedDifferences.push({
          path,
          reason:
            "archive metadata or generated package.json key order; canonical entries match",
          canonicalSha256: left.canonicalSha256,
        });
      } else {
        differences.push({ path, first: left, second: right });
      }
    }
  }
  if (differences.length > 0) {
    throw new Error(
      `Unexplained artifact differences: ${differences.map(({ path }) => path).join(", ")}`,
    );
  }
  return {
    status: "reproducible",
    artifacts: first,
    permittedDifferences,
    buildIsolation: "separate forced local builds",
    remoteCache: false,
    telemetry: false,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const temporary = await mkdtemp(join(tmpdir(), "fuzit-reproducibility-"));
  try {
    const first = await buildArtifactSet(join(temporary, "first"));
    const second = await buildArtifactSet(join(temporary, "second"));
    process.stdout.write(
      `${JSON.stringify(compareArtifactSets(first, second))}\n`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
