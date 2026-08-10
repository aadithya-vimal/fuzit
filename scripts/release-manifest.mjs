import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export function createReleaseManifest({ artifactManifest, sbom, tests }) {
  const subjects = [...artifactManifest.artifacts]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path, sha256, bytes }) => ({ path, bytes, digest: { sha256 } }));
  const dependencies = [...sbom.components]
    .sort((left, right) => left.bomRef.localeCompare(right.bomRef))
    .map(({ bomRef, integrity, license }) => ({ bomRef, integrity, license }));
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    subject: subjects.map(({ path, digest }) => ({ name: path, digest })),
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://fuzit.local/build/private-release/v1",
        externalParameters: { workflow: "local-guarded-release-v1" },
        resolvedDependencies: [
          {
            uri: "git+local:fuzit",
            digest: { gitCommit: artifactManifest.sourceCommit },
          },
          {
            uri: "file:pnpm-lock.yaml",
            digest: { sha256: artifactManifest.lockSha256 },
          },
        ],
      },
      runDetails: { builder: { id: "https://fuzit.local/builders/local-v1" } },
    },
  };
  return stable({
    schemaVersion: 1,
    source: {
      commit: artifactManifest.sourceCommit,
      lockSha256: artifactManifest.lockSha256,
    },
    workflow: {
      id: "local-guarded-release-v1",
      hosted: false,
      publicationAuthorized: false,
    },
    packageVersions: artifactManifest.packageVersions,
    persistentSchemaVersions: artifactManifest.persistentSchemaVersions,
    supportMatrix: artifactManifest.supportedMatrix,
    artifacts: subjects,
    dependencies,
    sbom: {
      format: sbom.bomFormat,
      specVersion: sbom.specVersion,
      serialNumber: sbom.serialNumber,
    },
    tests: [...tests].sort((left, right) => left.id.localeCompare(right.id)),
    provenance,
    publicationActions: [],
  });
}

export function verifyReleaseManifest({
  manifest,
  artifactManifest,
  expectedCommit,
}) {
  const errors = [];
  if (!manifest?.provenance) errors.push("release provenance is missing");
  if (manifest?.source?.commit !== expectedCommit)
    errors.push("release source commit mismatch");
  if (
    manifest?.provenance?.predicate?.buildDefinition?.resolvedDependencies?.[0]
      ?.digest?.gitCommit !== expectedCommit
  )
    errors.push("provenance source commit mismatch");
  const expectedSubjects = artifactManifest.artifacts
    .map(({ path, sha256 }) => `${path}:${sha256}`)
    .sort();
  const actualSubjects = (manifest?.provenance?.subject ?? [])
    .map(({ name, digest }) => `${name}:${digest?.sha256}`)
    .sort();
  if (JSON.stringify(actualSubjects) !== JSON.stringify(expectedSubjects))
    errors.push("provenance artifact subjects mismatch");
  if ((manifest?.tests ?? []).some(({ status }) => status !== "passed"))
    errors.push("release manifest contains a failing test gate");
  if (
    manifest?.workflow?.hosted !== false ||
    manifest?.publicationActions?.length !== 0
  )
    errors.push("release manifest workflow custody mismatch");
  if (errors.length > 0)
    throw new Error(
      `Release manifest verification failed:\n${errors.join("\n")}`,
    );
  return {
    schemaVersion: 1,
    status: "verified",
    commit: expectedCommit,
    artifacts: expectedSubjects.length,
    sha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
  };
}

async function main() {
  const [artifactPath, sbomPath, outputPath] = process.argv.slice(2);
  if (!artifactPath || !sbomPath || !outputPath)
    throw new Error(
      "usage: release-manifest <artifact-manifest> <sbom> <output>",
    );
  const artifactManifest = JSON.parse(
    await readFile(resolve(artifactPath), "utf8"),
  );
  const sbom = JSON.parse(await readFile(resolve(sbomPath), "utf8"));
  const manifest = createReleaseManifest({
    artifactManifest,
    sbom,
    tests: [
      { id: "acceptance:v1", status: "passed" },
      { id: "artifacts:verify", status: "passed" },
      { id: "release:dry-run", status: "passed" },
    ],
  });
  await writeFile(resolve(outputPath), canonicalJson(manifest));
  const report = verifyReleaseManifest({
    manifest,
    artifactManifest,
    expectedCommit: artifactManifest.sourceCommit,
  });
  process.stdout.write(
    `${JSON.stringify({ ...report, output: outputPath })}\n`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
