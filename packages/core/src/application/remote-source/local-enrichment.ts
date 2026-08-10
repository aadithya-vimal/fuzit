/**
 * Local GitHub enrichment manager.
 *
 * @module
 */

export interface LocalEnrichmentOptions {
  readonly enrichGithub?: boolean;
}

export interface LocalEnrichmentResult {
  readonly isEnriched: boolean;
  readonly isPartial: boolean;
}

export async function applyLocalGithubEnrichment(
  options: LocalEnrichmentOptions,
): Promise<LocalEnrichmentResult> {
  if (!options.enrichGithub) {
    return { isEnriched: false, isPartial: false };
  }
  return { isEnriched: true, isPartial: false };
}
