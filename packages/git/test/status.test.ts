import { describe, expect, it } from "vitest";

import { parseGitStatus } from "../src/index.js";

describe("Git status", () => {
  it("normalizes spaces, Unicode, untracked, and ignored files", () => {
    expect(parseGitStatus("?? space 世界.txt\0!! ignored.txt\0")).toEqual([
      { path: "space 世界.txt", kind: "untracked" },
    ]);
  });

  it("parses renames, conflicts, and deletions", () => {
    expect(
      parseGitStatus("R  new.txt\0old.txt\0UU conflict.txt\0 D gone.txt\0"),
    ).toEqual([
      { path: "conflict.txt", kind: "conflict" },
      { path: "gone.txt", kind: "deleted" },
      { path: "new.txt", originalPath: "old.txt", kind: "renamed" },
    ]);
  });

  it("distinguishes staged, unstaged, and submodule-like changes", () => {
    expect(parseGitStatus("M  staged.txt\0 M work.txt\0S  module\0")).toEqual([
      { path: "module", kind: "submodule" },
      { path: "staged.txt", kind: "staged" },
      { path: "work.txt", kind: "unstaged" },
    ]);
  });
});
