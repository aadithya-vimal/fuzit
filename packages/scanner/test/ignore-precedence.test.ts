import { describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "@fuzit/core";
import {
  evaluateIgnorePrecedence,
  parseGitignore,
  type ExplicitPathRule,
} from "../src/index.js";

const p = normalizeRepositoryRelativePath;
const rule = (
  pattern: string,
  action: "include" | "exclude",
): ExplicitPathRule => ({ pattern, action, reason: `${action} ${pattern}` });

describe("ignore precedence", () => {
  it("uses CLI over conflicting project and ignore rules", () => {
    const git = parseGitignore("src/**\n", p(".gitignore"), p("."));
    const fuzit = parseGitignore("!src/**\n", p(".fuzitignore"), p("."));
    const decision = evaluateIgnorePrecedence({
      path: p("src/index.ts"),
      isDirectory: false,
      cliRules: [rule("src/**", "exclude")],
      projectRules: [rule("src/**", "include")],
      fuzitignoreRules: fuzit,
      gitignoreRules: git,
    });
    expect(decision).toMatchObject({
      excluded: true,
      winningLayer: "cli",
      winningRule: "src/**",
    });
    expect(decision.shadowedRules.map(({ layer }) => layer)).toEqual([
      "project-config",
      "fuzitignore",
      "gitignore",
    ]);
  });

  it("uses the last matching rule within one layer", () => {
    expect(
      evaluateIgnorePrecedence({
        path: p("src/index.ts"),
        isDirectory: false,
        cliRules: [rule("src/**", "exclude"), rule("src/index.ts", "include")],
      }),
    ).toMatchObject({ excluded: false, winningLayer: "cli" });
  });

  it("never overrides a hard exclusion", () => {
    expect(
      evaluateIgnorePrecedence({
        path: p("node_modules/x.js"),
        isDirectory: false,
        cliRules: [rule("node_modules/**", "include")],
      }),
    ).toMatchObject({
      excluded: true,
      winningLayer: "hard-exclusion",
    });
  });

  it("deduplicates by selecting the last duplicate rule", () => {
    const duplicate = [rule("src/**", "exclude"), rule("src/**", "include")];
    expect(
      evaluateIgnorePrecedence({
        path: p("src/a.ts"),
        isDirectory: false,
        projectRules: duplicate,
      }),
    ).toMatchObject({ excluded: false, winningLayer: "project-config" });
  });
});
