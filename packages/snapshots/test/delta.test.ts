import { describe, expect, it } from "vitest";

import { computeSnapshotDelta, createSnapshot } from "../src/index.js";

const snapshot = (
  files: readonly { path: string; sha256: string }[],
  options: { complete?: boolean; configHash?: string } = {},
) =>
  createSnapshot({
    repositoryRevision: "head",
    dirty: false,
    configHash: options.configHash ?? "config",
    fileFingerprints: [...files],
    bundleIdentityInputs: [],
    complete: options.complete ?? true,
    diagnostics: [],
  });

describe("snapshot delta", () => {
  it("infers a rename from an identical hash", () => {
    const delta = computeSnapshotDelta(
      snapshot([{ path: "old", sha256: "a" }]),
      snapshot([{ path: "new", sha256: "a" }]),
    );
    expect(delta.files).toContainEqual(
      expect.objectContaining({
        kind: "renamed",
        path: "new",
        previousPath: "old",
        confidence: 1,
      }),
    );
  });

  it("does not infer a modify plus rename", () => {
    const delta = computeSnapshotDelta(
      snapshot([{ path: "old", sha256: "a" }]),
      snapshot([{ path: "new", sha256: "b" }]),
    );
    expect(delta.files.map((file) => file.kind).sort()).toEqual([
      "added",
      "deleted",
    ]);
  });

  it("does not invent a rename for duplicate hashes", () => {
    const delta = computeSnapshotDelta(
      snapshot([{ path: "old", sha256: "a" }]),
      snapshot([
        { path: "new-a", sha256: "a" },
        { path: "new-b", sha256: "a" },
      ]),
    );
    expect(delta.files.some((file) => file.kind === "renamed")).toBe(false);
  });

  it("marks a delta incomplete when either snapshot is partial", () => {
    expect(
      computeSnapshotDelta(snapshot([]), snapshot([], { complete: false }))
        .complete,
    ).toBe(false);
  });

  it("reports config-only changes", () => {
    const delta = computeSnapshotDelta(
      snapshot([], { configHash: "a" }),
      snapshot([], { configHash: "b" }),
    );
    expect(delta).toMatchObject({ configChanged: true, files: [] });
  });
});
