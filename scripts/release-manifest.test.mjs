import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  createReleaseManifest,
  verifyReleaseManifest,
} from "./release-manifest.mjs";

const commit = "a".repeat(40);
const artifactManifest = {
  sourceCommit: commit,
  lockSha256: "b".repeat(64),
  packageVersions: { "@fuzit/cli": "0.0.1" },
  persistentSchemaVersions: { incrementalIndex: 1 },
  supportedMatrix: { node: ["24"], platforms: ["win32-x64"] },
  artifacts: [{ path: "z.tgz", bytes: 10, sha256: "c".repeat(64) }],
};
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: "urn:uuid:test",
  components: [
    { bomRef: "pkg:npm/a@1", integrity: "sha256:d", license: "MIT" },
  ],
};
const tests = [{ id: "acceptance:v1", status: "passed" }];

describe("release manifest and provenance", () => {
  it("is canonical and deterministic across input ordering", () => {
    const first = createReleaseManifest({ artifactManifest, sbom, tests });
    const second = createReleaseManifest({
      artifactManifest,
      sbom,
      tests: [...tests].reverse(),
    });
    expect(canonicalJson(second)).toBe(canonicalJson(first));
    expect(
      verifyReleaseManifest({
        manifest: first,
        artifactManifest,
        expectedCommit: commit,
      }),
    ).toMatchObject({
      status: "verified",
      commit,
      artifacts: 1,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects missing provenance", () => {
    const manifest = createReleaseManifest({ artifactManifest, sbom, tests });
    expect(() =>
      verifyReleaseManifest({
        manifest: { ...manifest, provenance: undefined },
        artifactManifest,
        expectedCommit: commit,
      }),
    ).toThrow("provenance is missing");
  });

  it("rejects mismatched provenance identity", () => {
    const manifest = createReleaseManifest({ artifactManifest, sbom, tests });
    manifest.provenance.subject[0].digest.sha256 = "e".repeat(64);
    expect(() =>
      verifyReleaseManifest({
        manifest,
        artifactManifest,
        expectedCommit: commit,
      }),
    ).toThrow("subjects mismatch");
  });
});
