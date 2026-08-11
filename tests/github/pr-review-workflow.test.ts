import { describe, it, expect } from "vitest";
import { runPrReview } from "@fuzit/core";

describe("GH-022: Flagship Read-Only PR Review Workflow", () => {
  it("executes read-only PR review workflow for valid PR ref", async () => {
    const res = await runPrReview({
      prRef: {
        kind: "github-pull-request",
        host: {
          webHost: "github.com",
          apiHost: "api.github.com",
          isEnterprise: false,
        },
        owner: "owner",
        repo: "repo",
        number: 123,
      },
      fixtureTransport: async (url) => ({
        ok: true,
        status: 200,
        headers: {},
        body: url.includes("/files")
          ? JSON.stringify([
              {
                filename: "src/auth.ts",
                status: "modified",
                additions: 3,
                deletions: 1,
                patch:
                  "@@ -1 +1 @@\n-export const auth = false\n+export const auth = true",
              },
            ])
          : JSON.stringify({
              title: "Repair authentication",
              state: "open",
              user: { login: "alice" },
              base: { ref: "main", sha: "base" },
              head: { ref: "repair", sha: "head" },
            }),
      }),
    });

    expect(res.ok).toBe(true);
    expect(res.prNumber).toBe(123);
    expect(res.targetRepo).toBe("owner/repo");
    expect(res.title).toBe("Repair authentication");
    expect(res.files[0]?.path).toBe("src/auth.ts");
    expect(res.summary).toContain("No high-confidence findings");
  });

  it("does not report success when GitHub returns not found", async () => {
    await expect(
      runPrReview({
        prRef: {
          kind: "github-pull-request",
          host: {
            webHost: "github.com",
            apiHost: "api.github.com",
            isEnterprise: false,
          },
          owner: "owner",
          repo: "repo",
          number: 999999,
        },
        fixtureTransport: async () => ({
          ok: true,
          status: 404,
          headers: {},
          body: "{}",
        }),
      }),
    ).rejects.toThrow("HTTP 404");
  });
});
