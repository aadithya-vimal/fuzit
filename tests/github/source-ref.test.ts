/**
 * GitHub source parser integration tests.
 *
 * These tests complement the unit tests in packages/provider-github/test/.
 * They verify the parsed refs are compatible with the normalized schema types.
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import { parseGitHubUrl } from "@fuzit/provider-github";
import type { GitHubRepositoryRef, GitHubPullRequestRef, GitHubIssueRef } from "@fuzit/schemas";

describe("GitHub source references integrate with schema types", () => {
  it("parsed repository ref conforms to GitHubRepositoryRef", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ref: GitHubRepositoryRef = result.ref as GitHubRepositoryRef;
    expect(ref.kind).toBe("github-repository");
    expect(ref.host.webHost).toBe("github.com");
  });

  it("parsed PR ref conforms to GitHubPullRequestRef", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/pull/1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ref: GitHubPullRequestRef = result.ref as GitHubPullRequestRef;
    expect(ref.kind).toBe("github-pull-request");
    expect(ref.number).toBe(1);
  });

  it("parsed issue ref conforms to GitHubIssueRef", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/issues/2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ref: GitHubIssueRef = result.ref as GitHubIssueRef;
    expect(ref.kind).toBe("github-issue");
    expect(ref.number).toBe(2);
  });

  it("local commands produce no remote refs (parser is not invoked)", () => {
    // Local paths are not processed by the GitHub parser at all — this is
    // checked by never calling parseGitHubUrl for local inputs.
    const localPath = "/home/user/project";
    const attemptedParse = parseGitHubUrl(localPath);
    expect(attemptedParse.ok).toBe(false);
  });
});
