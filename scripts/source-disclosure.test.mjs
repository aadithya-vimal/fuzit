import { describe, expect, it } from "vitest";
import { auditDisclosure, classifyPath } from "./source-disclosure.mjs";

describe("public source disclosure", () => {
  it("classifies the complete tracked tree deterministically", async () => {
    const first = await auditDisclosure();
    expect(await auditDisclosure()).toEqual(first);
    expect(first.counts.public).toBeGreaterThan(0);
    expect(first.status).toBe("approved-public-source-boundary");
    expect(first.counts["internal-only"]).toBe(0);
    expect(first.counts["legally-sensitive"]).toBe(0);
  });

  it("fails closed when no disclosure rule owns a path", () => {
    expect(() => classifyPath("unknown.txt", { rules: [] })).toThrow(
      /unclassified source path/,
    );
  });
});
