import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("prepared security reporting process", () => {
  it("aligns the normative policy and release readiness record", async () => {
    const [security, release] = await Promise.all([
      readFile(resolve(root, "SECURITY.md"), "utf8"),
      readFile(resolve(root, "docs/release/security-reporting.md"), "utf8"),
    ]);
    const normalizedSecurity = security.toLowerCase().replace(/\s+/g, " ");
    const normalizedRelease = release.toLowerCase().replace(/\s+/g, " ");
    for (const required of [
      "no public release",
      "private",
      "three business days",
      "seven business days",
      "synthetic",
      "owner approval",
    ]) {
      expect(normalizedSecurity).toContain(required);
      expect(normalizedRelease).toContain(required);
    }
  });

  it("does not fabricate a contact, advisory, bounty, or public intake", async () => {
    const security = await readFile(resolve(root, "SECURITY.md"), "utf8");
    const normalizedSecurity = security.toLowerCase().replace(/\s+/g, " ");
    expect(security).toContain(
      "No public security address or intake URL has been approved",
    );
    expect(security).toContain(
      "No GitHub Advisory, CVE request, or public notification",
    );
    expect(security).not.toMatch(
      /mailto:|security@[\w.-]+|https?:\/\/[^\s)]*security/i,
    );
    expect(normalizedSecurity).toContain("not a bounty or legal promise");
  });
});
