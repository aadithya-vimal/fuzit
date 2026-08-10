import { describe, it, expect } from "vitest";
import { normalizeIssue, normalizeIssueComment } from "@fuzit/provider-github";

describe("GH-019: Ingest Issues and Issue Comments", () => {
  it("normalizes raw issue and issue comment payload", () => {
    const ref = {
      kind: "github-issue" as const,
      host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
      owner: "owner",
      repo: "repo",
      number: 10,
    };

    const issue = normalizeIssue(ref, { title: "Feature request", body: "Please add X", state: "open", user: { login: "charlie" } });
    expect(issue.number).toBe(10);
    expect(issue.title).toBe("Feature request");

    const comment = normalizeIssueComment(ref, { id: 300, body: "+1", user: { login: "dave" } });
    expect(comment.commentId).toBe(300);
    expect(comment.body).toBe("+1");
  });
});
