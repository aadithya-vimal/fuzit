/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Issue and issue comments ingestion service.
 *
 * @module
 */

import {
  buildStableRecordId,
  PROVIDER_RECORDS_SCHEMA_VERSION,
  type IssueCommentRecord,
  type IssueRecord,
} from "@fuzit/schemas";
import type { GitHubIssueRef } from "@fuzit/schemas";

export function normalizeIssue(
  ref: GitHubIssueRef,
  rawIssueRecord: unknown,
): IssueRecord {
  const rawIssue = rawIssueRecord as Record<string, any>;
  const repoFullName = `${ref.owner}/${ref.repo}`;
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      ref.host.webHost,
      repoFullName,
      "issue",
      ref.number,
    ),
    kind: "issue",
    provider: "github",
    host: ref.host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    number: ref.number,
    title: rawIssue.title ?? "",
    body: rawIssue.body ?? "",
    state: rawIssue.state === "closed" ? "closed" : "open",
    authorLogin: rawIssue.user?.login ?? "ghost",
    labels: Array.isArray(rawIssue.labels)
      ? rawIssue.labels.map((l: Record<string, unknown>) =>
          String(l.name ?? ""),
        )
      : [],
  };
}

export function normalizeIssueComment(
  ref: GitHubIssueRef,
  rawCommentRecord: unknown,
): IssueCommentRecord {
  const rawComment = rawCommentRecord as Record<string, any>;
  const repoFullName = `${ref.owner}/${ref.repo}`;
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      ref.host.webHost,
      repoFullName,
      "issue-comment",
      rawComment.id,
    ),
    kind: "issue-comment",
    provider: "github",
    host: ref.host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    issueNumber: ref.number,
    commentId: Number(rawComment.id),
    authorLogin: rawComment.user?.login ?? "ghost",
    body: rawComment.body ?? "",
  };
}
