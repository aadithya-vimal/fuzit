import { describe, expect, it } from "vitest";

import { normalizeGitDiff, parseGitHistory } from "@fuzit/git";

describe("Git performance limits", () => {
  it("parses a bounded large history and diff", () => {
    const records = Array.from(
      { length: 100 },
      (_, index) =>
        `${index.toString(16).padStart(40, "a")}\u001f\u001fAuthor\u001fa@example.test\u001f2026-01-01T00:00:00Z\u001fsubject\u001e`,
    ).join("");
    expect(parseGitHistory(records)).toHaveLength(100);
    const diff = normalizeGitDiff("x".repeat(2 * 1024 * 1024), ["a"], {
      maximumBytes: 1024 * 1024,
      maximumFiles: 100,
    });
    expect(Buffer.byteLength(diff.patch)).toBe(1024 * 1024);
  });
});
