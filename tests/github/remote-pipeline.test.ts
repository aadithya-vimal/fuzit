import { describe, it, expect } from "vitest";
import { prepareRemotePipeline } from "@fuzit/core";

describe("GH-013: Remote Repository Pipeline Connection", () => {
  it("bridges remote repository ref to scanner pipeline with provenance", async () => {
    const res = await prepareRemotePipeline(
      {
        ref: {
          kind: "github-repository",
          host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
          owner: "owner",
          repo: "repo",
        },
      },
      "/tmp/worktree_123"
    );

    expect(res.success).toBe(true);
    expect(res.remoteProvenance.host).toBe("github.com");
    expect(res.scannedPath).toBe("/tmp/worktree_123");
  });
});
