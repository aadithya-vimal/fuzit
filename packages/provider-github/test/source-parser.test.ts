/**
 * Tests for GitHub source URL and shorthand parsing (GH-002).
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import {
  parseGitHubUrl,
  parseOwnerRepo,
  parseOwnerRepoHash,
  parseNumericWithRepo,
} from "@fuzit/provider-github";

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

describe("parseGitHubUrl: github.com repository", () => {
  it("parses basic repository URL", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-repository");
    expect(result.ref.host.webHost).toBe("github.com");
    expect(result.ref.host.apiHost).toBe("api.github.com");
    expect(result.ref.host.isEnterprise).toBe(false);
    expect(result.ref.owner).toBe("owner");
    expect(result.ref.repo).toBe("repo");
  });

  it("strips .git suffix", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo.git");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-repository");
  });

  it("parses tree/branch URL as repository with revision", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/tree/main");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.ref.kind !== "github-repository") throw new Error("wrong kind");
    expect(result.ref.revision).toBe("main");
  });
});

describe("parseGitHubUrl: pull request URL", () => {
  it("parses PR URL", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/pull/123");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-pull-request");
    if (result.ref.kind !== "github-pull-request") return;
    expect(result.ref.number).toBe(123);
    expect(result.ref.owner).toBe("owner");
    expect(result.ref.repo).toBe("repo");
  });

  it("rejects PR URL with non-numeric number", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/pull/abc");
    expect(result.ok).toBe(false);
  });
});

describe("parseGitHubUrl: issue URL", () => {
  it("parses issue URL", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/issues/456");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-issue");
    if (result.ref.kind !== "github-issue") return;
    expect(result.ref.number).toBe(456);
  });
});

describe("parseGitHubUrl: enterprise URL", () => {
  it("parses GitHub Enterprise repository URL", () => {
    const result = parseGitHubUrl("https://github.example.com/owner/repo");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.ref.kind !== "github-repository") return;
    expect(result.ref.host.isEnterprise).toBe(true);
    expect(result.ref.host.webHost).toBe("github.example.com");
    expect(result.ref.host.apiHost).toBe("github.example.com/api/v3");
  });

  it("parses GitHub Enterprise PR URL", () => {
    const result = parseGitHubUrl(
      "https://github.example.com/owner/repo/pull/42",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-pull-request");
  });
});

describe("parseGitHubUrl: credential-bearing URL rejection", () => {
  it("rejects URL with username", () => {
    const result = parseGitHubUrl("https://user@github.com/owner/repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/credential/i);
    }
  });

  it("rejects URL with username:password", () => {
    const credentialBearingUrl = [
      "https://user",
      ":",
      "pass",
      "@github.com/owner/repo",
    ].join("");
    const result = parseGitHubUrl(credentialBearingUrl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/credential/i);
    }
  });

  it("rejects http:// scheme", () => {
    const result = parseGitHubUrl("http://github.com/owner/repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/scheme/i);
    }
  });

  it("rejects URL fragment with content", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo#readme");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/fragment/i);
    }
  });
});

describe("parseGitHubUrl: unsupported paths", () => {
  it("rejects URL with only one path segment", () => {
    const result = parseGitHubUrl("https://github.com/owner");
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported path segment (compare)", () => {
    const result = parseGitHubUrl(
      "https://github.com/owner/repo/compare/main...dev",
    );
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shorthand parsers
// ---------------------------------------------------------------------------

describe("parseOwnerRepo", () => {
  it("parses valid OWNER/REPO", () => {
    const result = parseOwnerRepo("acme/widget");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-repository");
    expect(result.ref.owner).toBe("acme");
    expect(result.ref.repo).toBe("widget");
  });

  it("rejects too many slashes", () => {
    const result = parseOwnerRepo("acme/widget/extra");
    expect(result.ok).toBe(false);
  });

  it("rejects owner starting with hyphen", () => {
    const result = parseOwnerRepo("-acme/widget");
    expect(result.ok).toBe(false);
  });

  it("rejects encoded traversal", () => {
    const result = parseOwnerRepo("acme%2F../widget");
    expect(result.ok).toBe(false);
  });
});

describe("parseOwnerRepoHash: ambiguous shorthand rejection", () => {
  it("rejects without recordKind (ambiguous)", () => {
    const result = parseOwnerRepoHash("acme/widget#10");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/ambiguous/i);
    }
  });

  it("parses as PR with explicit kind", () => {
    const result = parseOwnerRepoHash("acme/widget#10", "pull-request");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-pull-request");
    if (result.ref.kind !== "github-pull-request") return;
    expect(result.ref.number).toBe(10);
  });

  it("parses as issue with explicit kind", () => {
    const result = parseOwnerRepoHash("acme/widget#10", "issue");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-issue");
  });

  it("rejects invalid number", () => {
    const result = parseOwnerRepoHash("acme/widget#abc", "pull-request");
    expect(result.ok).toBe(false);
  });
});

describe("parseNumericWithRepo", () => {
  it("parses numeric PR with repo context", () => {
    const result = parseNumericWithRepo("42", "acme/widget", "pull-request");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-pull-request");
    if (result.ref.kind !== "github-pull-request") return;
    expect(result.ref.number).toBe(42);
  });

  it("parses numeric issue with repo context", () => {
    const result = parseNumericWithRepo("7", "acme/widget", "issue");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref.kind).toBe("github-issue");
  });

  it("rejects zero as number", () => {
    const result = parseNumericWithRepo("0", "acme/widget", "pull-request");
    expect(result.ok).toBe(false);
  });
});
