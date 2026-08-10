import { describe, it, expect } from "vitest";
import { normalizePullRequestData } from "@fuzit/provider-github";

describe("GH-015: Ingest Pull Request Metadata", () => {
  it("normalizes raw PR payload into PullRequestRecord", () => {
    const record = normalizePullRequestData(
      {
        kind: "github-pull-request",
        host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
        owner: "owner",
        repo: "repo",
        number: 42,
      },
      {
        title: "Fix bug",
        body: "Fixes issue #1",
        state: "open",
        draft: false,
        user: { login: "bob" },
        base: { ref: "main", sha: "111" },
        head: { ref: "patch-1", sha: "222" },
        labels: [{ name: "bug" }],
      }
    );

    expect(record.number).toBe(42);
    expect(record.title).toBe("Fix bug");
    expect(record.authorLogin).toBe("bob");
    expect(record.labels).toEqual(["bug"]);
  });
});
