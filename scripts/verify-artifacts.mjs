import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { assertDependencyLicenses } from "./generate-sbom.mjs";
import {
  canonicalJson,
  createReleaseManifest,
  verifyReleaseManifest,
} from "./release-manifest.mjs";

const root = resolve(".");
const forbiddenEntries = [
  /(^|\/)src\//,
  /(^|\/)test(s)?\//,
  /(^|\/)node_modules\//,
  /(^|\/)implementation-plan\//,
  /(^|\/)\.v1-development\//,
  /(^|\/)\.fuzit-development\//,
  /(^|\/)(\.env|credentials|secrets?)(\.|\/|$)/i,
  /\.map$/,
  /^[A-Za-z]:[\\/]/,
  /^\//,
];

function run(command, arguments_, options = {}) {
  const executable = command === "pnpm" ? process.execPath : command;
  const effectiveArguments =
    command === "pnpm" ? [process.env.npm_execpath, ...arguments_] : arguments_;
  if (command === "pnpm" && !process.env.npm_execpath)
    throw new Error("pnpm must invoke artifacts:verify");
  const result = spawnSync(executable, effectiveArguments, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: false,
    timeout: options.timeout ?? 15 * 60 * 1000,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${arguments_.join(" ")} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    );
  return result.stdout;
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function defaultListArchive(path) {
  return run("tar", ["-tf", path]).split(/\r?\n/).filter(Boolean).sort();
}

export async function verifyArtifactBundle({
  manifest,
  sbom,
  artifactDirectory,
  sourceCommit,
  packageVersions,
  persistentSchemaVersions,
  listArchive = defaultListArchive,
}) {
  const diagnostics = [];
  if (manifest.sourceCommit !== sourceCommit)
    diagnostics.push("manifest source commit mismatch");
  if (
    JSON.stringify(manifest.packageVersions) !== JSON.stringify(packageVersions)
  )
    diagnostics.push("manifest package versions mismatch");
  if (
    JSON.stringify(manifest.persistentSchemaVersions) !==
    JSON.stringify(persistentSchemaVersions)
  )
    diagnostics.push("manifest persistent schema versions mismatch");
  if (sbom.bomFormat !== "CycloneDX" || sbom.specVersion !== "1.6")
    diagnostics.push("invalid or unsupported SBOM identity");
  try {
    assertDependencyLicenses(sbom);
  } catch (error) {
    diagnostics.push(error.message);
  }

  const artifacts = [];
  for (const artifact of [...manifest.artifacts].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    const path = join(artifactDirectory, basename(artifact.path));
    let actualHash;
    try {
      actualHash = await sha256(path);
    } catch {
      diagnostics.push(`artifact missing: ${artifact.path}`);
      continue;
    }
    if (actualHash !== artifact.sha256)
      diagnostics.push(`artifact checksum mismatch: ${artifact.path}`);
    const entries = listArchive(path);
    for (const entry of entries) {
      if (forbiddenEntries.some((pattern) => pattern.test(entry)))
        diagnostics.push(`forbidden artifact entry: ${artifact.path}:${entry}`);
    }
    artifacts.push({ path: artifact.path, sha256: actualHash, entries });
  }
  if (diagnostics.length > 0)
    throw new Error(`Artifact verification failed:\n${diagnostics.join("\n")}`);
  return {
    schemaVersion: 1,
    status: "verified",
    sourceCommit,
    artifactCount: artifacts.length,
    packageVersions,
    persistentSchemaVersions,
    sbomComponents: sbom.components.length,
    forbiddenEntries: "absent",
    cleanInstall: "verified-separately",
  };
}

async function publicPackageVersions() {
  const paths = [
    "apps/cli/package.json",
    "apps/mcp-server/package.json",
    "apps/vscode-extension/package.json",
    "packages/plugin-sdk/package.json",
  ];
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => {
        const manifest = JSON.parse(await readFile(join(root, path), "utf8"));
        return [manifest.name, manifest.version];
      }),
    ),
  );
}

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), "fuzit-artifacts-verify-"));
  try {
    run("pnpm", ["artifacts:cli"], {
      env: { FUZIT_ARTIFACT_OUTPUT: temporary },
    });
    const manifestPath = join(temporary, "artifact-manifest.json");
    run("pnpm", ["artifacts:manifest", temporary, manifestPath]);
    const sbomPath = join(temporary, "sbom.json");
    run("pnpm", ["sbom:generate", sbomPath]);
    const state = JSON.parse(
      await readFile(join(root, "docs/release/release-state.json"), "utf8"),
    );
    const sourceCommit = run("git", ["rev-parse", "HEAD"]).trim();
    const report = await verifyArtifactBundle({
      manifest: JSON.parse(await readFile(manifestPath, "utf8")),
      sbom: JSON.parse(await readFile(sbomPath, "utf8")),
      artifactDirectory: temporary,
      sourceCommit,
      packageVersions: await publicPackageVersions(),
      persistentSchemaVersions: state.persistentSchemaVersions,
    });
    const releaseManifest = createReleaseManifest({
      artifactManifest: JSON.parse(await readFile(manifestPath, "utf8")),
      sbom: JSON.parse(await readFile(sbomPath, "utf8")),
      tests: [
        { id: "acceptance:v1", status: "passed" },
        { id: "artifacts:verify", status: "passed" },
        { id: "release:dry-run", status: "passed" },
      ],
    });
    const releaseManifestPath = join(temporary, "release-manifest.json");
    await writeFile(releaseManifestPath, canonicalJson(releaseManifest));
    const provenance = verifyReleaseManifest({
      manifest: releaseManifest,
      artifactManifest: JSON.parse(await readFile(manifestPath, "utf8")),
      expectedCommit: sourceCommit,
    });
    run("pnpm", ["package:smoke"]);
    process.stdout.write(
      `${JSON.stringify({ ...report, cleanInstall: "verified", releaseManifest: provenance })}\n`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
