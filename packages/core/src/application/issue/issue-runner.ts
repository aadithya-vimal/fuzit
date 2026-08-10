/**
 * Direct issue-context workflow runner.
 *
 * @module
 */

import type { GitHubIssueRef } from "@fuzit/schemas";

export interface IssueRunOptions {
  readonly issueRef: GitHubIssueRef;
  readonly profileName?: string;
}

export interface IssueRunResult {
  readonly ok: boolean;
  readonly issueNumber: number;
  readonly targetRepo: string;
  readonly summary: string;
}

export async function runIssueContext(
  options: IssueRunOptions,
): Promise<IssueRunResult> {
  return {
    ok: true,
    issueNumber: options.issueRef.number,
    targetRepo: `${options.issueRef.owner}/${options.issueRef.repo}`,
    summary: `Issue Context for #${options.issueRef.number} on ${options.issueRef.owner}/${options.issueRef.repo}`,
  };
}
