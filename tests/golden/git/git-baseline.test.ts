import { describe, expect, it } from "vitest";

import { normalizeGitDiff, parseGitHistory, runGit } from "@fuzit/git";

describe("Git privacy and determinism golden gate", () => {
  it("sanitizes credentials and missing Git", async () => {
    const credential = "https://user:password@example.test/repo";
    const result = await runGit(
      ["-e", `process.stderr.write(${JSON.stringify(credential)})`],
      { executable: process.execPath },
    );
    expect(result.stderr).not.toContain("password");
    expect((await runGit([], { executable: "fuzit-missing-git" })).ok).toBe(
      false,
    );
  });

  it("bounds history and diff repeatably", () => {
    const record = `${"a".repeat(40)}\u001f\u001fAuthor\u001fa@example.test\u001f2026-01-01T00:00:00Z\u001fsubject\u001e`;
    expect(parseGitHistory(record)).toHaveLength(1);
    const first = normalizeGitDiff("x".repeat(1000), ["b", "a"], {
      maximumBytes: 32,
      maximumFiles: 1,
    });
    expect(first).toEqual(
      normalizeGitDiff("x".repeat(1000), ["b", "a"], {
        maximumBytes: 32,
        maximumFiles: 1,
      }),
    );
    expect(first.truncated).toBe(true);
  });
});
