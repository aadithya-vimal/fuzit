/**
 * Tests for repository resolution (GH-007).
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import { resolveRepository, resolveCredential } from "@fuzit/provider-github";
import type { GitHubHostIdentity } from "@fuzit/schemas";

const host: GitHubHostIdentity = {
  webHost: "github.com",
  apiHost: "api.github.com",
  isEnterprise: false,
};
const enterpriseHost: GitHubHostIdentity = {
  webHost: "ghe.example.com",
  apiHost: "ghe.example.com/api/v3",
  isEnterprise: true,
};
const cred = resolveCredential({ host: "github.com", env: {} });
const ALLOWED = ["github.com", "api.github.com"];

function fixture(status: number, body: object | null) {
  return async () => ({
    ok: true as const,
    status,
    headers: { "content-type": "application/vnd.github+json" },
    body: body ? JSON.stringify(body) : "",
  });
}

const publicRepo = {
  id: 1,
  node_id: "R_abc",
  name: "repo",
  full_name: "owner/repo",
  owner: { login: "owner" },
  private: false,
  visibility: "public",
  default_branch: "main",
  archived: false,
  disabled: false,
  fork: false,
  html_url: "https://github.com/owner/repo",
};

describe("GH-007: repository resolution", () => {
  it("public repository resolves correctly", async () => {
    const result = await resolveRepository({
      host,
      owner: "owner",
      repo: "repo",
      credential: cred,
      allowedHosts: ALLOWED,
      fixtureTransport: fixture(200, publicRepo),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.visibility).toBe("public");
    expect(result.record.defaultBranch).toBe("main");
    expect(result.record.owner).toBe("owner");
    expect(result.record.webUrl).not.toMatch(/@/); // no credentials
  });

  it("private authorized repository resolves", async () => {
    const priv = { ...publicRepo, private: true, visibility: "private" };
    const result = await resolveRepository({
      host,
      owner: "owner",
      repo: "repo",
      credential: cred,
      allowedHosts: ALLOWED,
      fixtureTransport: fixture(200, priv),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.visibility).toBe("private");
  });

  it("transferred repository detects canonical URL change", async () => {
    const transferred = {
      ...publicRepo,
      owner: { login: "new-owner" },
      full_name: "new-owner/repo",
    };
    const result = await resolveRepository({
      host,
      owner: "old-owner",
      repo: "repo",
      credential: cred,
      allowedHosts: ALLOWED,
      fixtureTransport: fixture(200, transferred),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.canonicalUrlChanged).toBe(true);
    expect(result.record.priorFullName).toBe("old-owner/repo");
    expect(result.record.owner).toBe("new-owner");
  });

  it("archived repository", async () => {
    const archived = { ...publicRepo, archived: true };
    const result = await resolveRepository({
      host,
      owner: "owner",
      repo: "repo",
      credential: cred,
      allowedHosts: ALLOWED,
      fixtureTransport: fixture(200, archived),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.isArchived).toBe(true);
  });

  it("enterprise API path used for enterprise host", async () => {
    // The fixture just returns a valid repo; we're verifying the host metadata
    const result = await resolveRepository({
      host: enterpriseHost,
      owner: "owner",
      repo: "repo",
      credential: resolveCredential({ host: "ghe.example.com", env: {} }),
      allowedHosts: ["ghe.example.com"],
      fixtureTransport: fixture(200, publicRepo),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.host.isEnterprise).toBe(true);
  });

  it("404 returns not-found", async () => {
    const result = await resolveRepository({
      host,
      owner: "owner",
      repo: "missing",
      credential: cred,
      allowedHosts: ALLOWED,
      fixtureTransport: fixture(404, null),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("not-found");
  });

  it("403 returns forbidden", async () => {
    const result = await resolveRepository({
      host,
      owner: "owner",
      repo: "private",
      credential: cred,
      allowedHosts: ALLOWED,
      fixtureTransport: fixture(403, null),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("forbidden");
  });
});
