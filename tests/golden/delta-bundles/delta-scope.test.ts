import { describe, expect, it } from "vitest";

import { selectDeltaScope } from "../../../packages/core/src/index.js";

describe("delta bundle scope", () => {
  it("preserves deleted-file metadata", () => {
    expect(
      selectDeltaScope([], {
        complete: true,
        files: [{ path: "gone", previousPath: "gone", kind: "deleted" }],
      }).deleted,
    ).toEqual([{ path: "gone", previousPath: "gone" }]);
  });
  it("includes the target of a rename", () => {
    expect(
      selectDeltaScope([{ path: "new" }], {
        complete: true,
        files: [{ path: "new", previousPath: "old", kind: "renamed" }],
      }).included,
    ).toEqual([{ path: "new" }]);
  });
  it("selects nothing when there are no changes", () => {
    expect(
      selectDeltaScope([{ path: "same" }], {
        complete: true,
        files: [{ path: "same", previousPath: "same", kind: "unchanged" }],
      }).included,
    ).toEqual([]);
  });
  it("preserves partial baseline status", () => {
    expect(
      selectDeltaScope([], { complete: false, files: [] }).baselineComplete,
    ).toBe(false);
  });
  it("accounts for budget using only included content", () => {
    const result = selectDeltaScope(
      [
        { path: "changed", bytes: 10 },
        { path: "same", bytes: 20 },
      ],
      {
        complete: true,
        files: [
          { path: "changed", previousPath: "changed", kind: "modified" },
          { path: "same", previousPath: "same", kind: "unchanged" },
        ],
      },
    );
    expect(result.included.reduce((sum, item) => sum + item.bytes, 0)).toBe(10);
  });
});
