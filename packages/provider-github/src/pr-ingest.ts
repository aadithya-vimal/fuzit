/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pull request ingestion service.
 *
 * @module
 */

import {
  buildStableRecordId,
  PROVIDER_RECORDS_SCHEMA_VERSION,
  type PullRequestRecord,
} from "@fuzit/schemas";
import type { GitHubPullRequestRef } from "@fuzit/schemas";

export function normalizePullRequestData(
  ref: GitHubPullRequestRef,
  rawRecord: unknown,
): PullRequestRecord {
  const raw = rawRecord as Record<string, any>;
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      ref.host.webHost,
      `${ref.owner}/${ref.repo}`,
      "pull-request",
      ref.number,
    ),
    kind: "pull-request",
    provider: "github",
    host: ref.host,
    repositoryFullName: `${ref.owner}/${ref.repo}`,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    number: ref.number,
    title: raw.title ?? "",
    body: raw.body ?? "",
    state: raw.merged ? "merged" : raw.state === "closed" ? "closed" : "open",
    isDraft: Boolean(raw.draft),
    authorLogin: raw.user?.login ?? "ghost",
    baseRef: raw.base?.ref ?? "main",
    baseSha: raw.base?.sha ?? "",
    headRef: raw.head?.ref ?? "",
    headSha: raw.head?.sha ?? "",
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((l: Record<string, unknown>) => String(l.name ?? ""))
      : [],
  };
}
