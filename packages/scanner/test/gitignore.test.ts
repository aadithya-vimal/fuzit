import { describe, expect, it } from "vitest";

import { normalizeRepositoryRelativePath } from "@fuzit/core";

import { evaluateGitignore, parseGitignore } from "../src/index.js";

const path = normalizeRepositoryRelativePath;

function rules(contents: string, scope = ".") {
  const canonicalScope = path(scope);
  return parseGitignore(
    contents,
    path(scope === "." ? ".gitignore" : `${scope}/.gitignore`),
    canonicalScope,
  );
}

describe(".gitignore semantics", () => {
  it("applies nested ignore scope", () => {
    const nestedRules = rules("*.tmp\n", "packages/cli");
    expect(
      evaluateGitignore(path("packages/cli/cache.tmp"), false, nestedRules),
    ).toMatchObject({
      ignored: true,
      rule: { source: "packages/cli/.gitignore", line: 1 },
    });
    expect(
      evaluateGitignore(path("packages/core/cache.tmp"), false, nestedRules),
    ).toEqual({ ignored: false, rule: null });
  });

  it("uses the last matching negation", () => {
    const parsed = rules("*.log\n!important.log\n");
    expect(
      evaluateGitignore(path("important.log"), false, parsed),
    ).toMatchObject({
      ignored: false,
      rule: { line: 2, pattern: "!important.log", negated: true },
    });
  });

  it("supports escaped leading markers and spaces", () => {
    const parsed = rules("\\!important.txt\nspace\\ name.txt\n");
    expect(
      evaluateGitignore(path("!important.txt"), false, parsed).ignored,
    ).toBe(true);
    expect(
      evaluateGitignore(path("space name.txt"), false, parsed).ignored,
    ).toBe(true);
  });

  it("matches directory patterns and descendants", () => {
    const parsed = rules("logs/\n");
    expect(evaluateGitignore(path("logs"), true, parsed).ignored).toBe(true);
    expect(
      evaluateGitignore(path("logs/output.txt"), false, parsed).ignored,
    ).toBe(true);
  });

  it("honors root anchoring", () => {
    const parsed = rules("/root-only.txt\n");
    expect(
      evaluateGitignore(path("root-only.txt"), false, parsed).ignored,
    ).toBe(true);
    expect(
      evaluateGitignore(path("src/root-only.txt"), false, parsed).ignored,
    ).toBe(false);
  });

  it("parses CRLF with deterministic line provenance", () => {
    const parsed = rules("# comment\r\n*.tmp\r\n!keep.tmp\r\n");
    expect(evaluateGitignore(path("cache.tmp"), false, parsed)).toMatchObject({
      ignored: true,
      rule: { line: 2, pattern: "*.tmp" },
    });
  });
});
