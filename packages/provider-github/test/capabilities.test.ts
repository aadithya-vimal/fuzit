/**
 * Tests for GitHub provider capabilities (GH-006).
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import {
  resolveCapabilities,
  anonymousCapabilities,
  resolveCredential,
} from "@fuzit/provider-github";
import type { GitHubHostIdentity } from "@fuzit/schemas";

const githubCom: GitHubHostIdentity = {
  webHost: "github.com",
  apiHost: "api.github.com",
  isEnterprise: false,
};

const enterprise: GitHubHostIdentity = {
  webHost: "ghe.example.com",
  apiHost: "ghe.example.com/api/v3",
  isEnterprise: true,
};

describe("GH-006: provider capabilities", () => {
  it("anonymous public capability lists all types as available or unknown", () => {
    const cap = anonymousCapabilities(githubCom);
    expect(cap.isAuthenticated).toBe(false);
    expect(cap.credentialSource).toBe("anonymous");
    expect(cap.capabilities.length).toBeGreaterThan(0);
    const states = cap.capabilities.map((c) => c.state);
    // All should be available or unknown, none unavailable for anonymous public
    expect(states.every((s) => s === "available" || s === "unknown")).toBe(
      true,
    );
  });

  it("authenticated capability fixture marks all types available", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: "fake-token-for-test" },
    });
    const cap = resolveCapabilities(githubCom, cred);
    expect(cap.isAuthenticated).toBe(true);
    const unavailable = cap.capabilities.filter(
      (c) => c.state === "unavailable",
    );
    expect(unavailable).toHaveLength(0);
  });

  it("missing issue/check permission produces partial diagnostic", () => {
    const cred = resolveCredential({ host: "github.com", env: {} });
    const cap = resolveCapabilities(githubCom, cred, {
      missingPermissions: ["issue", "check-run"],
    });
    expect(cap.partial).toBe(true);
    const issueCapability = cap.capabilities.find(
      (c) => c.recordType === "issue",
    );
    expect(issueCapability?.state).toBe("unavailable");
    expect(issueCapability?.reason).toBe("permission-denied");
    expect(cap.diagnostics.length).toBeGreaterThan(0);
    // Diagnostics must not contain tokens
    for (const d of cap.diagnostics) {
      expect(d).not.toMatch(/ghp_|Bearer|token/i);
    }
  });

  it("unknown enterprise version resolves with enterprise host", () => {
    const cred = resolveCredential({ host: "ghe.example.com", env: {} });
    const cap = resolveCapabilities(enterprise, cred);
    expect(cap.host.isEnterprise).toBe(true);
    expect(cap.host.webHost).toBe("ghe.example.com");
  });

  it("capabilities have deterministic ordering", () => {
    const cred = resolveCredential({ host: "github.com", env: {} });
    const cap1 = resolveCapabilities(githubCom, cred);
    const cap2 = resolveCapabilities(githubCom, cred);
    const types1 = cap1.capabilities.map((c) => c.recordType);
    const types2 = cap2.capabilities.map((c) => c.recordType);
    expect(types1).toEqual(types2);
  });
});
