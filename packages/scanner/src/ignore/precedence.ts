import type { RepositoryRelativePath } from "@fuzit/core";

import { evaluateBuiltInExclusion } from "../exclusions/index.js";
import { evaluateGitignore, type GitignoreRule } from "./gitignore.js";

export type IgnoreLayer =
  | "hard-exclusion"
  | "cli"
  | "project-config"
  | "fuzitignore"
  | "gitignore"
  | "built-in-default";

export interface ExplicitPathRule {
  readonly pattern: string;
  readonly action: "include" | "exclude";
  readonly reason: string;
}

export interface IgnorePrecedenceInput {
  readonly path: RepositoryRelativePath;
  readonly isDirectory: boolean;
  readonly cliRules?: readonly ExplicitPathRule[];
  readonly projectRules?: readonly ExplicitPathRule[];
  readonly fuzitignoreRules?: readonly GitignoreRule[];
  readonly gitignoreRules?: readonly GitignoreRule[];
}

export interface IgnorePrecedenceDecision {
  readonly schemaVersion: 1;
  readonly path: RepositoryRelativePath;
  readonly excluded: boolean;
  readonly winningLayer: IgnoreLayer | null;
  readonly winningRule: string | null;
  readonly reason: string;
  readonly shadowedRules: readonly {
    readonly layer: IgnoreLayer;
    readonly rule: string;
  }[];
}

function match(pattern: string, path: RepositoryRelativePath): boolean {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replaceAll("**", "\0")
    .replaceAll("*", "[^/]*")
    .replaceAll("\0", ".*");
  return new RegExp(`^(?:${escaped})$`).test(path);
}

function lastExplicitMatch(
  rules: readonly ExplicitPathRule[],
  path: RepositoryRelativePath,
): ExplicitPathRule | undefined {
  return [...rules].reverse().find((rule) => match(rule.pattern, path));
}

export function evaluateIgnorePrecedence(
  input: IgnorePrecedenceInput,
): IgnorePrecedenceDecision {
  const candidates: {
    layer: IgnoreLayer;
    rule: string;
    excluded: boolean;
    reason: string;
  }[] = [];
  const builtIn = evaluateBuiltInExclusion(input.path);
  if (builtIn.rule?.hard) {
    return {
      schemaVersion: 1,
      path: input.path,
      excluded: true,
      winningLayer: "hard-exclusion",
      winningRule: builtIn.rule.id,
      reason: builtIn.rule.reason,
      shadowedRules: [],
    };
  }

  for (const [layer, rules] of [
    ["cli", input.cliRules ?? []],
    ["project-config", input.projectRules ?? []],
  ] as const) {
    const rule = lastExplicitMatch(rules, input.path);
    if (rule)
      candidates.push({
        layer,
        rule: rule.pattern,
        excluded: rule.action === "exclude",
        reason: rule.reason,
      });
  }
  for (const [layer, rules] of [
    ["fuzitignore", input.fuzitignoreRules ?? []],
    ["gitignore", input.gitignoreRules ?? []],
  ] as const) {
    const decision = evaluateGitignore(input.path, input.isDirectory, rules);
    if (decision.rule)
      candidates.push({
        layer,
        rule: decision.rule.pattern,
        excluded: decision.ignored,
        reason: `${decision.rule.source}:${decision.rule.line}`,
      });
  }
  if (builtIn.rule)
    candidates.push({
      layer: "built-in-default",
      rule: builtIn.rule.id,
      excluded: builtIn.excluded,
      reason: builtIn.rule.reason,
    });

  const winner = candidates[0];
  return {
    schemaVersion: 1,
    path: input.path,
    excluded: winner?.excluded ?? false,
    winningLayer: winner?.layer ?? null,
    winningRule: winner?.rule ?? null,
    reason: winner?.reason ?? "No rule matched.",
    shadowedRules: candidates
      .slice(1)
      .map(({ layer, rule }) => ({ layer, rule })),
  };
}
