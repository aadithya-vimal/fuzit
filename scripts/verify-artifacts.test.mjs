import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifyArtifactBundle } from "./verify-artifacts.mjs";

const temporary = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

async function fixture(
  entries = ["package/dist/index.js", "package/package.json"],
) {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-verify-artifacts-"));
  temporary.push(directory);
  const artifactPath = join(directory, "fuzit.tgz");
  await writeFile(artifactPath, "artifact");
  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update("artifact").digest("hex");
  const packageVersions = { "@fuzit/cli": "0.0.0" };
  const persistentSchemaVersions = { incrementalIndex: 1 };
  return {
    directory,
    artifactPath,
    options: {
      manifest: {
        sourceCommit: "a".repeat(40),
        packageVersions,
        persistentSchemaVersions,
        artifacts: [{ path: "fuzit.tgz", sha256 }],
      },
      sbom: {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        components: [],
        licenseFindings: [],
      },
      artifactDirectory: directory,
      sourceCommit: "a".repeat(40),
      packageVersions,
      persistentSchemaVersions,
      listArchive: () => entries,
    },
  };
}

describe("artifact verification", () => {
  it("returns a stable structured report for consistent identities", async () => {
    const { options } = await fixture();
    await expect(verifyArtifactBundle(options)).resolves.toEqual({
      schemaVersion: 1,
      status: "verified",
      sourceCommit: "a".repeat(40),
      artifactCount: 1,
      packageVersions: { "@fuzit/cli": "0.0.0" },
      persistentSchemaVersions: { incrementalIndex: 1 },
      sbomComponents: 0,
      forbiddenEntries: "absent",
      cleanInstall: "verified-separately",
    });
  });

  it("rejects a modified artifact", async () => {
    const { artifactPath, options } = await fixture();
    await writeFile(artifactPath, "tampered");
    await expect(verifyArtifactBundle(options)).rejects.toThrow(
      "artifact checksum mismatch",
    );
  });

  it("rejects a missing artifact", async () => {
    const { artifactPath, options } = await fixture();
    await rm(artifactPath);
    await expect(verifyArtifactBundle(options)).rejects.toThrow(
      "artifact missing",
    );
  });

  it("rejects an unexpected source map", async () => {
    const { options } = await fixture(["package/dist/index.js.map"]);
    await expect(verifyArtifactBundle(options)).rejects.toThrow(
      "forbidden artifact entry",
    );
  });
});
