import { describe, it, expect } from "vitest";
import { runIssueContext } from "@fuzit/core";

describe("GH-024: Direct Issue-Context Workflows", () => {
  it("executes issue-context workflow for valid issue ref", async () => {
    const res = await runIssueContext({
      issueRef: {
        kind: "github-issue",
        host: {
          webHost: "github.com",
          apiHost: "api.github.com",
          isEnterprise: false,
        },
        owner: "owner",
        repo: "repo",
        number: 456,
      },
      fixtureTransport: async (url) => ({
        ok: true,
        status: 200,
        headers: {},
        body: url.includes("/comments")
          ? JSON.stringify([
              { id: 1, user: { login: "bob" }, body: "Reproduced on Windows" },
            ])
          : JSON.stringify({
              title: "Scanner fails",
              body: "Bare scan exits with an error",
              state: "open",
              user: { login: "alice" },
              labels: [{ name: "bug" }],
            }),
      }),
    });

    expect(res.ok).toBe(true);
    expect(res.issueNumber).toBe(456);
    expect(res.targetRepo).toBe("owner/repo");
    expect(res.title).toBe("Scanner fails");
    expect(res.comments).toHaveLength(1);
    expect(res.summary).toContain("Bare scan exits with an error");
  });
});
