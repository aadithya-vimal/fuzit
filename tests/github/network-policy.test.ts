/**
 * Tests for network policy (GH-003).
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import {
  evaluateNetworkPolicy,
  isRedirectAllowed,
} from "@fuzit/schemas";
import { parseGitHubUrl } from "@fuzit/provider-github";

function ghRepo() {
  const r = parseGitHubUrl("https://github.com/owner/repo");
  if (!r.ok) throw new Error("parse failed");
  return r.ref;
}
function ghPr() {
  const r = parseGitHubUrl("https://github.com/owner/repo/pull/1");
  if (!r.ok) throw new Error("parse failed");
  return r.ref;
}
function ghIssue() {
  const r = parseGitHubUrl("https://github.com/owner/repo/issues/2");
  if (!r.ok) throw new Error("parse failed");
  return r.ref;
}
const localSource = { kind: "local" as const, path: "/home/user/project" };

describe("GH-003: network policy", () => {
  it("local path performs zero network (denied)", () => {
    const result = evaluateNetworkPolicy(localSource, "context");
    expect(result.authorized).toBe(false);
    if (result.authorized) return;
    expect(result.reason).toBe("local-source-no-enrichment");
    // explanation must not contain token-like content
    expect(result.explanation).not.toMatch(/ghp_|token|password/i);
  });

  it("remote GitHub URL authorizes exact GitHub hosts", () => {
    const result = evaluateNetworkPolicy(ghRepo(), "context");
    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.allowedHosts).toContain("github.com");
    expect(result.allowedHosts).toContain("api.github.com");
  });

  it("PR source authorizes network", () => {
    const result = evaluateNetworkPolicy(ghPr(), "context");
    expect(result.authorized).toBe(true);
  });

  it("issue source authorizes network", () => {
    const result = evaluateNetworkPolicy(ghIssue(), "context");
    expect(result.authorized).toBe(true);
  });

  it("review command authorizes network for local source", () => {
    const result = evaluateNetworkPolicy(localSource, "review");
    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.reason).toBe("command-is-review");
  });

  it("pr command authorizes network for local source", () => {
    const result = evaluateNetworkPolicy(localSource, "pr");
    expect(result.authorized).toBe(true);
  });

  it("issue command authorizes network for local source", () => {
    const result = evaluateNetworkPolicy(localSource, "issue");
    expect(result.authorized).toBe(true);
  });

  it("explicit enrichment option authorizes network for local source", () => {
    const result = evaluateNetworkPolicy(localSource, "scan", {
      explicitEnrichment: true,
    });
    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.reason).toBe("explicit-enrichment-option");
  });

  it("unrelated redirect rejected", () => {
    const allowed = isRedirectAllowed("https://evil.com/steal", [
      "github.com",
      "api.github.com",
    ]);
    expect(allowed).toBe(false);
  });

  it("same-host redirect allowed", () => {
    const allowed = isRedirectAllowed(
      "https://github.com/owner/repo",
      ["github.com", "api.github.com"],
    );
    expect(allowed).toBe(true);
  });

  it("http redirect rejected (non-https)", () => {
    const allowed = isRedirectAllowed("http://github.com/owner/repo", [
      "github.com",
    ]);
    expect(allowed).toBe(false);
  });

  it("enterprise host requires matching policy", () => {
    const entResult = parseGitHubUrl("https://ghe.example.com/owner/repo");
    expect(entResult.ok).toBe(true);
    if (!entResult.ok) return;
    // Without allowedEnterpriseHosts configured
    const denied = evaluateNetworkPolicy(entResult.ref, "context", {
      allowedEnterpriseHosts: [],
    });
    expect(denied.authorized).toBe(false);
    if (denied.authorized) return;
    expect(denied.reason).toBe("enterprise-host-not-configured");
    // With allowedEnterpriseHosts configured
    const allowed = evaluateNetworkPolicy(entResult.ref, "context", {
      allowedEnterpriseHosts: ["ghe.example.com"],
    });
    expect(allowed.authorized).toBe(true);
  });

  it("debug output contains no absolute cache path or token", () => {
    const result = evaluateNetworkPolicy(localSource, "context");
    // Serialize result to a JSON string and check for sensitive content
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\/home\/|C:\\Users|ghp_|token/i);
  });
});
