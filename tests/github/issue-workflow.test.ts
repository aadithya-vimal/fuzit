import { describe, it, expect } from "vitest";
import { runIssueContext } from "@fuzit/core";

describe("GH-024: Direct Issue-Context Workflows", () => {
  it("executes issue-context workflow for valid issue ref", async () => {
    const res = await runIssueContext({
      issueRef: {
        kind: "github-issue",
        host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
        owner: "owner",
        repo: "repo",
        number: 456,
      },
    });

    expect(res.ok).toBe(true);
    expect(res.issueNumber).toBe(456);
    expect(res.targetRepo).toBe("owner/repo");
  });
});
