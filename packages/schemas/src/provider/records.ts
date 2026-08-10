/**
 * Strict generic provider schemas and GitHub record normalization.
 *
 * Defines versioned normalized provider record types used across core selection,
 * graph, budgeting, and rendering pipelines.
 *
 * @module
 */

import type { GitHubHostIdentity } from "./source-ref.js";

export const PROVIDER_RECORDS_SCHEMA_VERSION = 1 as const;

export type ProviderRecordKind =
  | "repository"
  | "ref"
  | "commit"
  | "comparison"
  | "pull-request"
  | "pull-request-file"
  | "patch"
  | "review"
  | "review-comment"
  | "review-thread"
  | "issue"
  | "issue-comment"
  | "check-suite"
  | "check-run"
  | "commit-status"
  | "diagnostic"
  | "tombstone";

export interface BaseProviderRecord {
  readonly schemaVersion: typeof PROVIDER_RECORDS_SCHEMA_VERSION;
  readonly id: string;
  readonly kind: ProviderRecordKind;
  readonly provider: "github";
  readonly host: GitHubHostIdentity;
  readonly repositoryFullName: string;
  readonly observedAt: string;
  readonly completeness: "full" | "partial";
  readonly sensitivity: "public" | "private" | "internal";
}

export interface RefRecord extends BaseProviderRecord {
  readonly kind: "ref";
  readonly refName: string;
  readonly sha: string;
  readonly isDefaultBranch: boolean;
}

export interface CommitRecord extends BaseProviderRecord {
  readonly kind: "commit";
  readonly sha: string;
  readonly authorName: string;
  readonly message: string;
  readonly parentShas: readonly string[];
}

export interface PullRequestRecord extends BaseProviderRecord {
  readonly kind: "pull-request";
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed" | "merged";
  readonly isDraft: boolean;
  readonly authorLogin: string;
  readonly baseRef: string;
  readonly baseSha: string;
  readonly headRef: string;
  readonly headSha: string;
  readonly labels: readonly string[];
}

export interface PullRequestFileRecord extends BaseProviderRecord {
  readonly kind: "pull-request-file";
  readonly prNumber: number;
  readonly path: string;
  readonly status: "added" | "modified" | "removed" | "renamed";
  readonly additions: number;
  readonly deletions: number;
  readonly previousPath?: string;
}

export interface PatchRecord extends BaseProviderRecord {
  readonly kind: "patch";
  readonly prNumber: number;
  readonly path: string;
  readonly patchContent: string;
  readonly isTruncated: boolean;
}

export interface ReviewRecord extends BaseProviderRecord {
  readonly kind: "review";
  readonly prNumber: number;
  readonly reviewId: number;
  readonly authorLogin: string;
  readonly state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  readonly body: string;
}

export interface ReviewCommentRecord extends BaseProviderRecord {
  readonly kind: "review-comment";
  readonly prNumber: number;
  readonly commentId: number;
  readonly path: string;
  readonly line?: number;
  readonly authorLogin: string;
  readonly body: string;
}

export interface ReviewThreadRecord extends BaseProviderRecord {
  readonly kind: "review-thread";
  readonly prNumber: number;
  readonly threadId: string;
  readonly path: string;
  readonly isResolved: boolean;
  readonly comments: readonly ReviewCommentRecord[];
}

export interface IssueRecord extends BaseProviderRecord {
  readonly kind: "issue";
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed";
  readonly authorLogin: string;
  readonly labels: readonly string[];
}

export interface IssueCommentRecord extends BaseProviderRecord {
  readonly kind: "issue-comment";
  readonly issueNumber: number;
  readonly commentId: number;
  readonly authorLogin: string;
  readonly body: string;
}

export interface CheckRunRecord extends BaseProviderRecord {
  readonly kind: "check-run";
  readonly headSha: string;
  readonly name: string;
  readonly status: "queued" | "in_progress" | "completed";
  readonly conclusion?:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "timed_out"
    | "action_required";
  readonly summary?: string;
}

export interface CommitStatusRecord extends BaseProviderRecord {
  readonly kind: "commit-status";
  readonly headSha: string;
  readonly context: string;
  readonly state: "error" | "failure" | "pending" | "success";
  readonly description?: string;
}

export interface ProviderDiagnosticRecord extends BaseProviderRecord {
  readonly kind: "diagnostic";
  readonly category: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
}

export interface TombstoneRecord extends BaseProviderRecord {
  readonly kind: "tombstone";
  readonly originalKind: ProviderRecordKind;
  readonly reason: string;
}

export type NormalizedProviderRecord =
  | RefRecord
  | CommitRecord
  | PullRequestRecord
  | PullRequestFileRecord
  | PatchRecord
  | ReviewRecord
  | ReviewCommentRecord
  | ReviewThreadRecord
  | IssueRecord
  | IssueCommentRecord
  | CheckRunRecord
  | CommitStatusRecord
  | ProviderDiagnosticRecord
  | TombstoneRecord;

export function buildStableRecordId(
  provider: "github",
  host: string,
  repoFullName: string,
  kind: ProviderRecordKind,
  entityKey: string | number,
): string {
  return `${provider}:${host}:${repoFullName.toLowerCase()}:${kind}:${entityKey}`;
}
