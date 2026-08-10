import { describe, it, expect } from "vitest";
import { auditVsixPackage } from "./verify-vsix.mjs";

describe("Private VSIX Audit (V1-099)", () => {
  it("audits VSIX package contents and verifies private non-marketplace packaging", async () => {
    const report = await auditVsixPackage();
    expect(report.status).toBe("verified");
    expect(report.private).toBe(false);
    expect(report.marketplacePublicationConfigured).toBe(false);
    expect(report.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.entryCount).toBeGreaterThan(0);
    expect(report.extensionHostInstall).toBe("ok");
    expect(report.workspaceTrustSuite).toBe("required-separately");
  }, 120_000);
});
