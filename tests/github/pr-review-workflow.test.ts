import { describe, it, expect } from "vitest";
import { runPrReview } from "@fuzit/core";

describe("GH-022: Flagship Read-Only PR Review Workflow", () => {
  it("executes read-only PR review workflow for valid PR ref", async () => {
    const res = await runPrReview({
      prRef: {
        kind: "github-pull-request",
        host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
        owner: "owner",
        repo: "repo",
        number: 123,
      },
    });

    expect(res.ok).toBe(true);
    expect(res.prNumber).toBe(123);
    expect(res.targetRepo).toBe("owner/repo");
  });
});
