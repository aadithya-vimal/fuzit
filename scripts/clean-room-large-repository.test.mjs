import { describe, expect, it } from "vitest";
import { validateLargeRepositoryReport } from "./clean-room-large-repository.mjs";

const valid = {
  schemaVersion: 1,
  gate: "clean-room:large-repository",
  commit: "a".repeat(40),
  fileCount: 50_000,
  measurements: {
    coldMs: 20,
    warmMs: 10,
    incrementalMs: 1,
    contextGraphMs: 30,
    packedArtifactMs: 40,
    heapUsedBytes: 1000,
  },
  incrementalModified: 1,
  canonicalRebuildEquivalent: true,
  cancellation: "passed",
};
describe("large repository report", () => {
  it("enforces resources, relative incremental performance, cancellation, and rebuild equivalence", () =>
    expect(validateLargeRepositoryReport(valid)).toMatchObject({
      status: "passed",
      failures: 0,
      skips: 0,
    }));
  it("fails on semantic divergence or a missed relative target", () => {
    expect(() =>
      validateLargeRepositoryReport({
        ...valid,
        canonicalRebuildEquivalent: false,
      }),
    ).toThrow(/diverged/);
    expect(() =>
      validateLargeRepositoryReport({
        ...valid,
        measurements: { ...valid.measurements, incrementalMs: 121 },
      }),
    ).toThrow(/relative target/);
  });
});
