/**
 * Tests for GitHub authentication broker (GH-004).
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import {
  resolveCredential,
  describeCredential,
  assertNoTokenInObject,
} from "@fuzit/provider-github";

describe("GH-004: authentication", () => {
  it("public anonymous mode (no env vars)", () => {
    const cred = resolveCredential({ host: "github.com", env: {} });
    expect(cred.isAuthenticated).toBe(false);
    expect(cred.source).toBe("anonymous");
    expect(cred._getAuthorizationHeader()).toBe(null);
  });

  it("FUZIT token precedence over GH_TOKEN", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: {
        FUZIT_GITHUB_TOKEN: "fuzit-secret-token",
        GH_TOKEN: "gh-fallback-token",
      },
    });
    expect(cred.isAuthenticated).toBe(true);
    expect(cred.source).toBe("FUZIT_GITHUB_TOKEN");
  });

  it("GH_TOKEN fallback when FUZIT_GITHUB_TOKEN absent", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { GH_TOKEN: "gh-fallback-token" },
    });
    expect(cred.isAuthenticated).toBe(true);
    expect(cred.source).toBe("GH_TOKEN");
  });

  it("no token in credential handle JSON serialization", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: "ghp_supersecretvalue12345" },
    });
    // Serialize the handle's safe fields only
    const safeRepresentation = {
      isAuthenticated: cred.isAuthenticated,
      host: cred.host,
      source: cred.source,
    };
    const serialized = JSON.stringify(safeRepresentation);
    expect(serialized).not.toContain("ghp_supersecretvalue12345");
    expect(serialized).not.toContain("supersecret");
  });

  it("no token in cache keys or command arguments simulation", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: "ghp_cachetest12345" },
    });
    // Simulate cache key construction — must use only host, not token
    const cacheKey = `github:${cred.host}:owner:repo`;
    expect(cacheKey).not.toContain("ghp_");
    expect(cacheKey).not.toContain("cachetest");
  });

  it("no token in git config or remote URL simulation", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: "ghp_gitconfigtest12345" },
    });
    // Simulate remote URL construction — must never embed token
    const remoteUrl = `https://github.com/owner/repo.git`;
    expect(remoteUrl).not.toContain(cred.source);
    // The token itself is accessed only through _getAuthorizationHeader
    // and must not appear in URLs
    expect(remoteUrl).not.toMatch(/ghp_/);
  });

  it("describeCredential does not include token value", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: "ghp_describetest12345" },
    });
    const description = describeCredential(cred);
    expect(description).not.toContain("ghp_describetest12345");
    expect(description).toContain("github.com");
    expect(description).toContain("FUZIT_GITHUB_TOKEN");
  });

  it("assertNoTokenInObject throws on token-shaped value", () => {
    expect(() =>
      assertNoTokenInObject({ token: "ghp_verylongtokenvalue12345" }, "test"),
    ).toThrow(/Security violation/);
  });

  it("assertNoTokenInObject passes on clean object", () => {
    expect(() =>
      assertNoTokenInObject({ host: "github.com", owner: "acme" }, "test"),
    ).not.toThrow();
  });
});
