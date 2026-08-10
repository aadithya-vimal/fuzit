/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Checks and commit status ingestion service.
 *
 * @module
 */

import {
  buildStableRecordId,
  PROVIDER_RECORDS_SCHEMA_VERSION,
  type CheckRunRecord,
  type CommitStatusRecord,
} from "@fuzit/schemas";
import type { GitHubHostIdentity } from "@fuzit/schemas";

export function normalizeCheckRun(
  host: GitHubHostIdentity,
  repoFullName: string,
  rawCheckRunRecord: unknown,
): CheckRunRecord {
  const rawCheckRun = rawCheckRunRecord as Record<string, any>;
  const status =
    rawCheckRun.status === "completed"
      ? "completed"
      : rawCheckRun.status === "in_progress"
        ? "in_progress"
        : "queued";
  const conclusion =
    rawCheckRun.conclusion === "success"
      ? "success"
      : rawCheckRun.conclusion === "failure"
        ? "failure"
        : rawCheckRun.conclusion === "cancelled"
          ? "cancelled"
          : rawCheckRun.conclusion === "timed_out"
            ? "timed_out"
            : rawCheckRun.conclusion === "action_required"
              ? "action_required"
              : "neutral";
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      host.webHost,
      repoFullName,
      "check-run",
      rawCheckRun.id,
    ),
    kind: "check-run",
    provider: "github",
    host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    headSha: rawCheckRun.head_sha ?? "",
    name: rawCheckRun.name ?? "",
    status,
    ...(rawCheckRun.status === "completed" ? { conclusion } : {}),
    ...(rawCheckRun.output?.summary
      ? { summary: rawCheckRun.output.summary }
      : {}),
  };
}

export function normalizeCommitStatus(
  host: GitHubHostIdentity,
  repoFullName: string,
  rawStatusRecord: unknown,
): CommitStatusRecord {
  const rawStatus = rawStatusRecord as Record<string, any>;
  const state =
    rawStatus.state === "success"
      ? "success"
      : rawStatus.state === "failure"
        ? "failure"
        : rawStatus.state === "error"
          ? "error"
          : "pending";
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      host.webHost,
      repoFullName,
      "commit-status",
      `${rawStatus.context}:${rawStatus.id}`,
    ),
    kind: "commit-status",
    provider: "github",
    host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    headSha: rawStatus.sha ?? "",
    context: rawStatus.context ?? "default",
    state,
    description: rawStatus.description ?? undefined,
  };
}
