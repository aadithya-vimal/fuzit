/**
 * Flagship read-only PR review command service.
 *
 * @module
 */

import type { GitHubPullRequestRef } from "@fuzit/schemas";

export interface ReviewRunOptions {
  readonly prRef: GitHubPullRequestRef;
  readonly task?: string;
  readonly profileName?: string;
}

export interface ReviewRunResult {
  readonly ok: boolean;
  readonly prNumber: number;
  readonly targetRepo: string;
  readonly summary: string;
}

export async function runPrReview(
  options: ReviewRunOptions,
): Promise<ReviewRunResult> {
  return {
    ok: true,
    prNumber: options.prRef.number,
    targetRepo: `${options.prRef.owner}/${options.prRef.repo}`,
    summary: `PR Review for #${options.prRef.number} on ${options.prRef.owner}/${options.prRef.repo}`,
  };
}
