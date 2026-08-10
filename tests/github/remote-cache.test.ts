import { describe, it, expect } from "vitest";
import { getRemoteCacheInfo, createDisposableWorktree } from "@fuzit/git";

describe("GH-011: Remote Repository Cache and Worktrees", () => {
  it("computes deterministic cache paths per host/owner/repo", () => {
    const info = getRemoteCacheInfo("github.com", "owner", "repo");
    expect(info.bareRepoPath).toContain("github.com_owner_repo");
  });

  it("creates disposable worktree cleanup callback", async () => {
    const info = getRemoteCacheInfo("github.com", "owner", "repo");
    const { worktreePath, cleanup } = await createDisposableWorktree(info, "main");
    expect(worktreePath).toBeDefined();
    await cleanup();
  });
});
