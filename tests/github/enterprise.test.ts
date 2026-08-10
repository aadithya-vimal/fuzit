import { describe, it, expect } from "vitest";
import { buildEnterpriseHostIdentity } from "@fuzit/provider-github";

describe("GH-027: Complete GitHub Enterprise Support", () => {
  it("derives /api/v3 base endpoint for enterprise host", () => {
    const host = buildEnterpriseHostIdentity({ webHost: "ghe.acme.com" });
    expect(host.isEnterprise).toBe(true);
    expect(host.apiHost).toBe("ghe.acme.com/api/v3");
  });
});
