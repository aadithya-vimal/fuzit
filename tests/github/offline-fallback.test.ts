import { describe, it, expect } from "vitest";
import { checkOfflineCache, getRemoteCacheInfo } from "@fuzit/git";

describe("GH-014: Offline Remote Cache Fallback", () => {
  it("returns isCached: false when cache meta missing", async () => {
    const info = getRemoteCacheInfo("github.com", "nonexistent_owner", "nonexistent_repo");
    const res = await checkOfflineCache(info, "main");
    expect(res.isCached).toBe(false);
    expect(res.isStale).toBe(true);
  });
});
