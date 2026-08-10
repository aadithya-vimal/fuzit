import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function publicPackageVersions() {
  const manifests = [
    "apps/cli/package.json",
    "apps/mcp-server/package.json",
    "apps/vscode-extension/package.json",
    "packages/plugin-sdk/package.json",
  ];
  return Object.fromEntries(
    await Promise.all(
      manifests.map(async (path) => {
        const manifest = JSON.parse(await readFile(join(root, path), "utf8"));
        return [manifest.name, manifest.version];
      }),
    ),
  );
}

export async function createArtifactManifest({
  artifactDirectory,
  outputPath,
}) {
  const directory = resolve(artifactDirectory);
  const output = resolve(outputPath);
  const paths = (await readdir(directory))
    .filter((path) => path !== basename(output) && !path.endsWith(".json"))
    .sort();
  if (paths.length === 0) throw new Error("No release artifacts were found.");
  const artifacts = await Promise.all(
    paths.map(async (path) => ({
      path: relative(root, join(directory, path)).replaceAll("\\", "/"),
      bytes: (await readFile(join(directory, path))).length,
      sha256: await sha256(join(directory, path)),
    })),
  );
  const state = JSON.parse(
    await readFile(join(root, "docs/release/release-state.json"), "utf8"),
  );
  const manifest = {
    schemaVersion: 1,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    lockSha256: await sha256(join(root, "pnpm-lock.yaml")),
    packageVersions: await publicPackageVersions(),
    persistentSchemaVersions: state.persistentSchemaVersions,
    supportedMatrix: {
      node: ["24"],
      platforms: ["darwin-arm64", "linux-x64", "win32-x64"],
    },
    artifacts,
  };
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function assertArtifactChecksums(manifest, artifactDirectory) {
  const directory = resolve(artifactDirectory);
  for (const artifact of manifest.artifacts) {
    const actual = await sha256(join(directory, basename(artifact.path)));
    if (actual !== artifact.sha256) {
      throw new Error(`Artifact checksum mismatch: ${artifact.path}`);
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const artifactDirectory = process.argv[2];
  const outputPath = process.argv[3];
  if (!artifactDirectory || !outputPath) {
    throw new Error(
      "usage: artifact-manifest <artifact-directory> <output-path>",
    );
  }
  const manifest = await createArtifactManifest({
    artifactDirectory,
    outputPath,
  });
  await assertArtifactChecksums(manifest, artifactDirectory);
  process.stdout.write(
    `${JSON.stringify({ manifest: outputPath, artifacts: manifest.artifacts.length })}\n`,
  );
}
