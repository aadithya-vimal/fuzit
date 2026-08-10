import { describe, expect, it } from "vitest";

import { collectGitIdentity, type GitProcessResult } from "../src/index.js";

const result = (stdout: string, ok = true): GitProcessResult => ({
  ok,
  exitCode: ok ? 0 : 1,
  stdout,
  stderr: "",
  timedOut: false,
  cancelled: false,
});

function runner(values: Record<string, GitProcessResult>) {
  return async (arguments_: readonly string[]) =>
    values[arguments_.join(" ")] ?? result("", false);
}

describe("Git identity", () => {
  it("handles detached HEAD and worktree roots", async () => {
    const identity = await collectGitIdentity(
      "worktree",
      runner({
        "rev-parse --show-toplevel": result("/repo/worktree\n"),
        "rev-parse --verify HEAD": result("a".repeat(40)),
        "status --porcelain=v1 --untracked-files=normal": result(""),
        "remote -v": result(""),
      }),
    );
    expect(identity).toMatchObject({
      root: "/repo/worktree",
      detached: true,
      branch: null,
    });
  });

  it("handles unborn and dirty branches", async () => {
    const identity = await collectGitIdentity(
      ".",
      runner({
        "rev-parse --show-toplevel": result("/repo"),
        "rev-parse --verify HEAD": result("", false),
        "symbolic-ref --short -q HEAD": result("main\n"),
        "status --porcelain=v1 --untracked-files=normal": result("?? a\n"),
        "remote -v": result(""),
      }),
    );
    expect(identity).toMatchObject({ head: null, branch: "main", dirty: true });
  });

  it("sanitizes credential-bearing remotes", async () => {
    const identity = await collectGitIdentity(
      ".",
      runner({
        "rev-parse --show-toplevel": result("/repo"),
        "rev-parse --verify HEAD": result("b".repeat(40)),
        "symbolic-ref --short -q HEAD": result("main"),
        "status --porcelain=v1 --untracked-files=normal": result(""),
        "remote -v": result(
          "origin https://user:password@example.test/repo (fetch)\n",
        ),
      }),
    );
    expect(identity.remotes[0]?.url).toBe(
      "https://[REDACTED]@example.test/repo",
    );
  });
});
