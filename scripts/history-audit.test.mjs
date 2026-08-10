import { describe, expect, it } from "vitest";

import { scanHistoryText } from "./history-audit.mjs";

describe("full-history audit", () => {
  it("detects high-confidence credentials without retaining source content", () => {
    const source =
      "-----BEGIN PRIVATE KEY-----\nfixture-body\n-----END PRIVATE KEY-----\nAKIAABCDEFGHIJKLMNOP\n";
    const findings = scanHistoryText(source);
    expect(findings.map(({ category }) => category)).toEqual([
      "aws-access-key",
      "private-key",
    ]);
    expect(JSON.stringify(findings)).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(JSON.stringify(findings)).not.toContain("PRIVATE KEY");
  });

  it("returns deterministic fingerprints for review-only private hosts", () => {
    const source =
      "+ endpoint=https://build.corp/path\n+ endpoint=https://build.corp/path\n";
    const first = scanHistoryText(source);
    expect(scanHistoryText(source)).toEqual(first);
    expect(first).toHaveLength(2);
    expect(first.every(({ category }) => category === "private-host")).toBe(
      true,
    );
  });
});
