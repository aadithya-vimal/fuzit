import { describe, it, expect } from "vitest";
import { createTombstone } from "@fuzit/provider-github";

describe("GH-020: Handle Provider Lifecycle and Deleted Records", () => {
  it("creates tombstone for deleted comment", () => {
    const host = { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false };
    const tombstone = createTombstone(host, "owner/repo", "review-comment", 999, "deleted-by-user");

    expect(tombstone.kind).toBe("tombstone");
    expect(tombstone.originalKind).toBe("review-comment");
    expect(tombstone.reason).toBe("deleted-by-user");
  });
});
