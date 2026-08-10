import { describe, expect, it } from "vitest";

import {
  canReuseScan,
  reconcileFingerprints,
  type FileFingerprint,
} from "../src/index.js";

const file = (
  path: string,
  sha256 = "a",
  modifiedAtMs = 1,
): FileFingerprint => ({
  path,
  sha256,
  modifiedAtMs,
  size: 1,
  acquisitionState: "complete",
});

describe("file fingerprint repository", () => {
  it("classifies unchanged and modified files", () => {
    expect(reconcileFingerprints([file("a")], [file("a")]).get("a")).toBe(
      "unchanged",
    );
    expect(
      reconcileFingerprints([file("a")], [file("a", "b", 2)]).get("a"),
    ).toBe("modified");
  });

  it("classifies deleted files", () => {
    expect(reconcileFingerprints([file("a")], []).get("a")).toBe("deleted");
  });

  it("treats a rename as delete plus new", () => {
    expect([...reconcileFingerprints([file("old")], [file("new")])]).toEqual([
      ["new", "new"],
      ["old", "deleted"],
    ]);
  });

  it("invalidates reuse on config change", () => {
    expect(
      canReuseScan(
        { scannerVersion: "1", configHash: "a", files: [] },
        { scannerVersion: "1", configHash: "b" },
      ),
    ).toBe(false);
  });

  it("invalidates reuse on scanner version change", () => {
    expect(
      canReuseScan(
        { scannerVersion: "1", configHash: "a", files: [] },
        { scannerVersion: "2", configHash: "a" },
      ),
    ).toBe(false);
  });
});
