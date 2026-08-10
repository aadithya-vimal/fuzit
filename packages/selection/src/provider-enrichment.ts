/**
 * Selection engine provider evidence merger.
 *
 * @module
 */

import type { NormalizedProviderRecord } from "@fuzit/schemas";

export interface ContextSelectionEnrichment {
  readonly providerRecords: readonly NormalizedProviderRecord[];
  readonly prioritizedPaths: readonly string[];
  readonly taskSeedText?: string;
}

export function mergeProviderEvidenceIntoSelection(
  records: readonly NormalizedProviderRecord[],
): ContextSelectionEnrichment {
  const paths = new Set<string>();
  let taskSeedText = "";

  for (const r of records) {
    if (r.kind === "pull-request-file") {
      paths.add(r.path);
    } else if (r.kind === "review-comment" || r.kind === "review-thread") {
      if (r.path) paths.add(r.path);
    } else if (r.kind === "issue") {
      taskSeedText += `${r.title}\n${r.body}\n`;
    }
  }

  const seed = taskSeedText.trim();
  return {
    providerRecords: records,
    prioritizedPaths: Array.from(paths),
    ...(seed ? { taskSeedText: seed } : {}),
  };
}
