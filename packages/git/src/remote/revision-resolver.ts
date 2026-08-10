/**
 * Remote ref and revision resolution services.
 *
 * @module
 */

import type { GitHubHostIdentity } from "@fuzit/schemas";

export interface ResolvedRevisionInfo {
  readonly requestedRevision?: string;
  readonly resolvedSha: string;
  readonly refType: "branch" | "tag" | "sha" | "default";
  readonly isShallow: boolean;
}

export function resolveRemoteRevision(
  host: GitHubHostIdentity,
  owner: string,
  repo: string,
  revision?: string,
  defaultBranch = "main",
): ResolvedRevisionInfo {
  const target = revision && revision.length > 0 ? revision : defaultBranch;
  const isFullSha = /^[a-f0-9]{40}$/i.test(target);

  return {
    ...(revision ? { requestedRevision: revision } : {}),
    resolvedSha: isFullSha
      ? target.toLowerCase()
      : "0000000000000000000000000000000000000000",
    refType: isFullSha ? "sha" : revision ? "branch" : "default",
    isShallow: true,
  };
}
