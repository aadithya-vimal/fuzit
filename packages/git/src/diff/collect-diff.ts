import { detectAndRedactCredentials } from "@fuzit/security";

import { runGit } from "../index.js";

export interface GitDiffResult {
  readonly available: boolean;
  readonly paths: readonly string[];
  readonly patch: string;
  readonly truncated: boolean;
  readonly binary: boolean;
  readonly findings: number;
  readonly diagnostic: string | null;
}

export function normalizeGitDiff(
  patch: string,
  paths: readonly string[],
  options: { readonly maximumBytes: number; readonly maximumFiles: number },
): GitDiffResult {
  const selectedPaths = [...paths]
    .map((path) => path.replaceAll("\\", "/"))
    .sort()
    .slice(0, options.maximumFiles);
  const bytes = Buffer.from(patch, "utf8");
  const bounded = bytes.subarray(0, options.maximumBytes).toString("utf8");
  const filtered = detectAndRedactCredentials(bounded, "git-diff");
  return {
    available: true,
    paths: selectedPaths,
    patch: filtered.content,
    truncated:
      bytes.byteLength > options.maximumBytes ||
      paths.length > options.maximumFiles,
    binary: /Binary files .+ differ|GIT binary patch/.test(patch),
    findings: filtered.findings.length,
    diagnostic: null,
  };
}

export async function collectGitDiff(
  cwd: string,
  options: {
    readonly base?: string;
    readonly maximumBytes?: number;
    readonly maximumFiles?: number;
  } = {},
): Promise<GitDiffResult> {
  const range = options.base === undefined ? [] : [`${options.base}..HEAD`];
  const names = await runGit(
    ["diff", "--name-only", "--no-ext-diff", "--no-color", ...range],
    { cwd },
  );
  const patch = await runGit(
    ["diff", "--no-ext-diff", "--no-color", "--binary", ...range],
    { cwd, maximumBytes: (options.maximumBytes ?? 1024 * 1024) + 1 },
  );
  if (!names.ok || !patch.ok)
    return {
      available: false,
      paths: [],
      patch: "",
      truncated: false,
      binary: false,
      findings: 0,
      diagnostic: "Git diff is unavailable for the requested revision.",
    };
  return normalizeGitDiff(
    patch.stdout,
    names.stdout.split(/\r?\n/).filter(Boolean),
    {
      maximumBytes: options.maximumBytes ?? 1024 * 1024,
      maximumFiles: options.maximumFiles ?? 100,
    },
  );
}
