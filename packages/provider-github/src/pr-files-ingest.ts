/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR files and patch ingestion service.
 *
 * @module
 */

import {
  buildStableRecordId,
  PROVIDER_RECORDS_SCHEMA_VERSION,
  type PatchRecord,
  type PullRequestFileRecord,
} from "@fuzit/schemas";
import type { GitHubPullRequestRef } from "@fuzit/schemas";

export interface NormalizedFileAndPatch {
  readonly fileRecord: PullRequestFileRecord;
  readonly patchRecord?: PatchRecord;
}

export function normalizePrFile(
  ref: GitHubPullRequestRef,
  rawFileRecord: unknown,
  maxPatchBytes = 50_000,
): NormalizedFileAndPatch {
  const rawFile = rawFileRecord as Record<string, any>;
  const repoFullName = `${ref.owner}/${ref.repo}`;
  const fileRecord: PullRequestFileRecord = {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      ref.host.webHost,
      repoFullName,
      "pull-request-file",
      `${ref.number}:${rawFile.filename}`,
    ),
    kind: "pull-request-file",
    provider: "github",
    host: ref.host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    prNumber: ref.number,
    path: rawFile.filename,
    status:
      rawFile.status === "added"
        ? "added"
        : rawFile.status === "removed"
          ? "removed"
          : rawFile.status === "renamed"
            ? "renamed"
            : "modified",
    additions: rawFile.additions ?? 0,
    deletions: rawFile.deletions ?? 0,
    ...(rawFile.previous_filename
      ? { previousPath: rawFile.previous_filename }
      : {}),
  };

  let patchRecord: PatchRecord | undefined;
  if (rawFile.patch) {
    const rawPatch = String(rawFile.patch);
    const isTruncated = rawPatch.length > maxPatchBytes;
    patchRecord = {
      schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
      id: buildStableRecordId(
        "github",
        ref.host.webHost,
        repoFullName,
        "patch",
        `${ref.number}:${rawFile.filename}`,
      ),
      kind: "patch",
      provider: "github",
      host: ref.host,
      repositoryFullName: repoFullName,
      observedAt: new Date().toISOString(),
      completeness: isTruncated ? "partial" : "full",
      sensitivity: "public",
      prNumber: ref.number,
      path: rawFile.filename,
      patchContent: isTruncated
        ? rawPatch.substring(0, maxPatchBytes)
        : rawPatch,
      isTruncated,
    };
  }

  return patchRecord ? { fileRecord, patchRecord } : { fileRecord };
}
