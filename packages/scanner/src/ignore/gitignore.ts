import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  normalizeRepositoryRelativePath,
  type RepositoryRelativePath,
} from "@fuzit/core";

export interface GitignoreRule {
  readonly source: RepositoryRelativePath;
  readonly line: number;
  readonly pattern: string;
  readonly negated: boolean;
  readonly directoryOnly: boolean;
  readonly scope: RepositoryRelativePath;
  readonly matcher: RegExp;
}

export interface GitignoreDecision {
  readonly ignored: boolean;
  readonly rule: Omit<GitignoreRule, "matcher"> | null;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globRegex(pattern: string, anchored: boolean): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
    } else if (character === "?") {
      source += "[^/]";
    } else if (character === "\\") {
      const next = pattern[index + 1];
      source += next === undefined ? "\\\\" : escapeRegex(next);
      if (next !== undefined) index += 1;
    } else {
      source += escapeRegex(character ?? "");
    }
  }
  return new RegExp(anchored ? `^${source}$` : `(?:^|/)${source}(?:$|/)`);
}

export function parseGitignore(
  contents: string,
  source: RepositoryRelativePath,
  scope: RepositoryRelativePath,
): readonly GitignoreRule[] {
  const rules: GitignoreRule[] = [];
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    if (rawLine === "" || rawLine.startsWith("#")) continue;
    let pattern = rawLine;
    let negated = false;
    if (pattern.startsWith("\\!") || pattern.startsWith("\\#")) {
      pattern = pattern.slice(1);
    } else if (pattern.startsWith("!")) {
      negated = true;
      pattern = pattern.slice(1);
    }
    const directoryOnly = pattern.endsWith("/");
    if (directoryOnly) pattern = pattern.slice(0, -1);
    const anchored = pattern.startsWith("/") || pattern.includes("/");
    if (pattern.startsWith("/")) pattern = pattern.slice(1);
    if (pattern === "") continue;
    rules.push({
      source,
      line: index + 1,
      pattern: rawLine,
      negated,
      directoryOnly,
      scope,
      matcher: globRegex(pattern, anchored),
    });
  }
  return rules;
}

function relativeToScope(
  path: RepositoryRelativePath,
  scope: RepositoryRelativePath,
): string | undefined {
  if (scope === ".") return path;
  if (path === scope) return ".";
  return path.startsWith(`${scope}/`)
    ? path.slice(scope.length + 1)
    : undefined;
}

export function evaluateGitignore(
  path: RepositoryRelativePath,
  isDirectory: boolean,
  rules: readonly GitignoreRule[],
): GitignoreDecision {
  let matched: GitignoreRule | null = null;
  let ignored = false;
  for (const rule of rules) {
    const scopedPath = relativeToScope(path, rule.scope);
    if (scopedPath === undefined) continue;
    if (
      rule.matcher.test(scopedPath) &&
      (!rule.directoryOnly || isDirectory || scopedPath.includes("/"))
    ) {
      matched = rule;
      ignored = !rule.negated;
    }
  }
  if (matched === null) return { ignored: false, rule: null };
  return {
    ignored,
    rule: {
      source: matched.source,
      line: matched.line,
      pattern: matched.pattern,
      negated: matched.negated,
      directoryOnly: matched.directoryOnly,
      scope: matched.scope,
    },
  };
}

export async function loadGitignoreRulesForPath(
  root: string,
  path: RepositoryRelativePath,
): Promise<readonly GitignoreRule[]> {
  const rules: GitignoreRule[] = [];
  const segments = path === "." ? [] : path.split("/");
  const scopes = [
    ".",
    ...segments
      .slice(0, -1)
      .map((_, index) => segments.slice(0, index + 1).join("/")),
  ];
  for (const scopeValue of scopes) {
    const scope = normalizeRepositoryRelativePath(scopeValue);
    const source = normalizeRepositoryRelativePath(
      scope === "." ? ".gitignore" : `${scope}/.gitignore`,
    );
    try {
      const contents = await readFile(join(root, ...source.split("/")), "utf8");
      rules.push(...parseGitignore(contents, source, scope));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      )
        continue;
      throw error;
    }
  }
  return rules;
}

export async function loadFuzitignoreRulesForPath(
  root: string,
): Promise<readonly GitignoreRule[]> {
  const source = normalizeRepositoryRelativePath(".fuzitignore");
  try {
    const contents = await readFile(join(root, ".fuzitignore"), "utf8");
    return parseGitignore(
      contents,
      source,
      normalizeRepositoryRelativePath("."),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return [];
    throw error;
  }
}
