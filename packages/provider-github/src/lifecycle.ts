/**
 * Lifecycle and tombstone handling for deleted/closed/transferred resources.
 *
 * @module
 */

import {
  buildStableRecordId,
  PROVIDER_RECORDS_SCHEMA_VERSION,
  type ProviderRecordKind,
  type TombstoneRecord,
} from "@fuzit/schemas";
import type { GitHubHostIdentity } from "@fuzit/schemas";

export function createTombstone(
  host: GitHubHostIdentity,
  repoFullName: string,
  originalKind: ProviderRecordKind,
  entityKey: string | number,
  reason: string,
): TombstoneRecord {
  return {
    schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
    id: buildStableRecordId(
      "github",
      host.webHost,
      repoFullName,
      "tombstone",
      `${originalKind}:${entityKey}`,
    ),
    kind: "tombstone",
    provider: "github",
    host,
    repositoryFullName: repoFullName,
    observedAt: new Date().toISOString(),
    completeness: "full",
    sensitivity: "public",
    originalKind,
    reason,
  };
}
