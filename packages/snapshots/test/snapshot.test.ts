import { describe, expect, it } from "vitest";

import { createSnapshot } from "../src/index.js";

const base = {
  repositoryRevision: "abc",
  dirty: false,
  configHash: "config",
  fileFingerprints: [{ path: "a.ts", sha256: "hash" }],
  bundleIdentityInputs: ["v1"],
  complete: true,
  diagnostics: [],
};

describe("immutable snapshots", () => {
  it("represents dirty repositories", () => {
    expect(createSnapshot({ ...base, dirty: true }).dirty).toBe(true);
  });
  it("represents non-Git directories", () => {
    expect(
      createSnapshot({ ...base, repositoryRevision: null }).repositoryRevision,
    ).toBeNull();
  });
  it("represents partial scans", () => {
    expect(createSnapshot({ ...base, complete: false }).complete).toBe(false);
  });
  it("gives the same meaningful state the same identity", () => {
    expect(createSnapshot(base).id).toBe(createSnapshot(base).id);
  });
  it("excludes volatile timestamps from identity", () => {
    expect(createSnapshot(base, "2020-01-01").id).toBe(
      createSnapshot(base, "2030-01-01").id,
    );
  });
});
