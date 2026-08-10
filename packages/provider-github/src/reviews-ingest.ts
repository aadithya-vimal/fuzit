/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR reviews, review comments, and thread grouping service.
 *
 * @module
 */

import {
  buildStableRecordId,
  PROVIDER_RECORDS_SCHEMA_VERSION,
  type ReviewCommentRecord,
  type ReviewRecord,
  type ReviewThreadRecord,
} from "@fuzit/schemas";
import type { GitHubPullRequestRef } from "@fuzit/schemas";

export function normalizeReview(
  ref: GitHubPullRequestRef,
  rawReviewRecord: unknown,
): ReviewRecord {
  const rawReview = rawReviewRecord as Record<string, any>;
  const repoFullName = `${ref.owner}/${ref.repo}`;
  const state =
    rawReview.state === "APPROVED"
      ? "APPROVED"
      : rawReview.state === "CHANGES_REQUESTED"
        ? "CHANGES_REQUESTED"
        : rawReview.state === "DISMISSED"
          ? "DISMISSED"
          : "COMMENTED";
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      ref.host.webHost,
      repoFullName,
      "review",
      rawReview.id,
    ),
    kind: "review",
    provider: "github",
    host: ref.host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    prNumber: ref.number,
    reviewId: Number(rawReview.id),
    authorLogin: rawReview.user?.login ?? "ghost",
    state,
    body: rawReview.body ?? "",
  };
}

export function groupReviewCommentsIntoThreads(
  ref: GitHubPullRequestRef,
  rawComments: readonly unknown[],
): readonly ReviewThreadRecord[] {
  const repoFullName = `${ref.owner}/${ref.repo}`;
  const threadsByInReplyTo = new Map<number, ReviewCommentRecord[]>();
  const rootComments: Record<string, any>[] = [];

  for (const rawC of rawComments) {
    const c = rawC as Record<string, any>;
    const commentRecord: ReviewCommentRecord = {
      schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
      id: buildStableRecordId(
        "github",
        ref.host.webHost,
        repoFullName,
        "review-comment",
        c.id,
      ),
      kind: "review-comment",
      provider: "github",
      host: ref.host,
      repositoryFullName: repoFullName,
      observedAt: new Date().toISOString(),
      completeness: "full",
      sensitivity: "public",
      prNumber: ref.number,
      commentId: Number(c.id),
      path: c.path ?? "",
      line: c.line ?? c.original_line,
      authorLogin: c.user?.login ?? "ghost",
      body: c.body ?? "",
    };

    if (c.in_reply_to_id) {
      const parentId = Number(c.in_reply_to_id);
      if (!threadsByInReplyTo.has(parentId)) {
        threadsByInReplyTo.set(parentId, []);
      }
      threadsByInReplyTo.get(parentId)!.push(commentRecord);
    } else {
      rootComments.push(c);
      if (!threadsByInReplyTo.has(Number(c.id))) {
        threadsByInReplyTo.set(Number(c.id), [commentRecord]);
      } else {
        threadsByInReplyTo.get(Number(c.id))!.unshift(commentRecord);
      }
    }
  }

  return rootComments.map((root) => {
    const threadComments = threadsByInReplyTo.get(Number(root.id)) ?? [];
    return {
      schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
      id: buildStableRecordId(
        "github",
        ref.host.webHost,
        repoFullName,
        "review-thread",
        root.id,
      ),
      kind: "review-thread",
      provider: "github",
      host: ref.host,
      repositoryFullName: repoFullName,
      observedAt: new Date().toISOString(),
      completeness: "full",
      sensitivity: "public",
      prNumber: ref.number,
      threadId: String(root.id),
      path: root.path ?? "",
      isResolved: false,
      comments: threadComments,
    };
  });
}
