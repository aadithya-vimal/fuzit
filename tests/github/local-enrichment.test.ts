import { describe, it, expect } from "vitest";
import { applyLocalGithubEnrichment } from "@fuzit/core";

describe("GH-026: Local GitHub Enrichment & Graceful Fallback", () => {
  it("enables enrichment only when explicit option is set", async () => {
    expect((await applyLocalGithubEnrichment({ enrichGithub: false })).isEnriched).toBe(false);
    expect((await applyLocalGithubEnrichment({ enrichGithub: true })).isEnriched).toBe(true);
  });
});
