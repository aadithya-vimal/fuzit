import { describe, it, expect } from "vitest";
import { normalizeReview, groupReviewCommentsIntoThreads } from "@fuzit/provider-github";

describe("GH-017: Ingest Reviews, Comments, and Threads", () => {
  it("normalizes review and groups inline comments into threads", () => {
    const ref = {
      kind: "github-pull-request" as const,
      host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
      owner: "owner",
      repo: "repo",
      number: 42,
    };

    const review = normalizeReview(ref, { id: 100, state: "APPROVED", body: "LGTM", user: { login: "alice" } });
    expect(review.reviewId).toBe(100);
    expect(review.state).toBe("APPROVED");

    const threads = groupReviewCommentsIntoThreads(ref, [
      { id: 1, path: "file.ts", line: 10, body: "Comment 1", user: { login: "bob" } },
      { id: 2, path: "file.ts", line: 10, in_reply_to_id: 1, body: "Reply 1", user: { login: "alice" } },
    ]);

    expect(threads.length).toBe(1);
    expect(threads[0]?.comments.length).toBe(2);
  });
});
