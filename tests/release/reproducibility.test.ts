import { describe, expect, it } from "vitest";

import { compareArtifactSets } from "../../scripts/verify-reproducibility.mjs";

const artifact = {
  path: "fuzit.tgz",
  bytes: 10,
  sha256: "a".repeat(64),
};

describe("release artifact reproducibility", () => {
  it("accepts byte-identical deterministically ordered artifact sets", () => {
    expect(compareArtifactSets([artifact], [{ ...artifact }])).toMatchObject({
      status: "reproducible",
      permittedDifferences: [],
      remoteCache: false,
      telemetry: false,
    });
  });

  it("rejects every unexplained byte difference", () => {
    expect(() =>
      compareArtifactSets(
        [artifact],
        [{ ...artifact, sha256: "b".repeat(64) }],
      ),
    ).toThrow("Unexplained artifact differences: fuzit.tgz");
  });

  it("documents volatile tar metadata only when canonical payloads match", () => {
    const report = compareArtifactSets(
      [{ ...artifact, canonicalSha256: "c".repeat(64) }],
      [
        {
          ...artifact,
          sha256: "b".repeat(64),
          canonicalSha256: "c".repeat(64),
        },
      ],
    );
    expect(report.permittedDifferences).toEqual([
      expect.objectContaining({ path: "fuzit.tgz" }),
    ]);
  });

  it("rejects missing artifacts", () => {
    expect(() => compareArtifactSets([artifact], [])).toThrow(
      "Unexplained artifact differences",
    );
  });
});
