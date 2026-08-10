import { describe, it, expect } from "vitest";
import { resolveRemoteRevision } from "@fuzit/git";

describe("GH-012: Acquire Repository Refs and Revisions", () => {
  it("resolves default branch when no revision specified", () => {
    const res = resolveRemoteRevision(
      { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
      "owner",
      "repo",
      undefined,
      "main"
    );
    expect(res.refType).toBe("default");
  });

  it("resolves full SHA revision", () => {
    const sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const res = resolveRemoteRevision(
      { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
      "owner",
      "repo",
      sha
    );
    expect(res.refType).toBe("sha");
    expect(res.resolvedSha).toBe(sha);
  });
});
