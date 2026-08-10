/**
 * GitHub repository resolution.
 *
 * Fetches and normalizes canonical repository identity, default branch,
 * visibility, archived/disabled/fork state, and sanitized web URL.
 * Handles renamed/transferred repositories via redirect provenance.
 *
 * @module
 */

import type { GitHubHostIdentity } from "@fuzit/schemas";
import type { CredentialHandle } from "./auth.js";
import type { FixtureTransport } from "./transport.js";
import { githubRequest } from "./transport.js";

// ---------------------------------------------------------------------------
// Repository record
// ---------------------------------------------------------------------------

export interface RepositoryRecord {
  readonly schemaVersion: 1;
  readonly kind: "repository";
  readonly host: GitHubHostIdentity;
  /** Canonical owner at time of observation. */
  readonly owner: string;
  /** Canonical repository name at time of observation. */
  readonly name: string;
  /** Full name: owner/name */
  readonly fullName: string;
  /** Node ID where available. */
  readonly nodeId?: string;
  readonly defaultBranch: string;
  readonly visibility: "public" | "private" | "internal" | "unknown";
  readonly isArchived: boolean;
  readonly isDisabled: boolean;
  readonly isFork: boolean;
  /** Sanitized web URL — no credentials. */
  readonly webUrl: string;
  /** If the canonical URL differs from the requested URL (transfer/rename). */
  readonly canonicalUrlChanged: boolean;
  /** Prior owner/name if transferred. */
  readonly priorFullName?: string;
  /** ISO timestamp of observation. */
  readonly observedAt: string;
  readonly completeness: "full" | "partial";
}

// ---------------------------------------------------------------------------
// Resolution result
// ---------------------------------------------------------------------------

export type ResolveRepositoryResult =
  | { readonly ok: true; readonly record: RepositoryRecord }
  | {
      readonly ok: false;
      readonly kind:
        | "not-found"
        | "forbidden"
        | "gone"
        | "network-error"
        | "invalid-response";
      readonly diagnostic: string;
    };

// ---------------------------------------------------------------------------
// Raw GitHub API shape (private — never exported from this module)
// ---------------------------------------------------------------------------

interface GhApiRepository {
  id: number;
  node_id?: string;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  visibility?: string;
  default_branch: string;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  html_url: string;
}

// ---------------------------------------------------------------------------
// Resolution function
// ---------------------------------------------------------------------------

export async function resolveRepository(options: {
  readonly host: GitHubHostIdentity;
  readonly owner: string;
  readonly repo: string;
  readonly credential: CredentialHandle;
  readonly allowedHosts: readonly string[];
  readonly fixtureTransport?: FixtureTransport;
}): Promise<ResolveRepositoryResult> {
  const { host, owner, repo, credential, allowedHosts } = options;
  const apiBase = host.isEnterprise
    ? `https://${host.apiHost}`
    : `https://api.github.com`;
  const url = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const transport = await githubRequest(
    url,
    options.fixtureTransport
      ? { allowedHosts, credential, fixtureTransport: options.fixtureTransport }
      : { allowedHosts, credential },
  );

  if (!transport.ok) {
    if (transport.kind === "server-error") {
      return {
        ok: false,
        kind: "network-error",
        diagnostic: transport.diagnostic,
      };
    }
    return {
      ok: false,
      kind: "network-error",
      diagnostic: transport.diagnostic,
    };
  }

  if (transport.status === 404) {
    return {
      ok: false,
      kind: "not-found",
      diagnostic: `Repository ${owner}/${repo} not found on ${host.webHost}`,
    };
  }
  if (transport.status === 403) {
    return {
      ok: false,
      kind: "forbidden",
      diagnostic: `Access forbidden to ${owner}/${repo} on ${host.webHost}`,
    };
  }
  if (transport.status === 410) {
    return {
      ok: false,
      kind: "gone",
      diagnostic: `Repository ${owner}/${repo} has been deleted`,
    };
  }
  if (transport.status !== 200) {
    return {
      ok: false,
      kind: "invalid-response",
      diagnostic: `Unexpected status ${transport.status}`,
    };
  }

  let data: GhApiRepository;
  try {
    data = JSON.parse(transport.body) as GhApiRepository;
  } catch {
    return {
      ok: false,
      kind: "invalid-response",
      diagnostic: "Invalid JSON from GitHub API",
    };
  }

  // Detect canonical URL change (transfer/rename)
  const canonicalOwner = data.owner.login;
  const canonicalName = data.name;
  const canonicalUrlChanged =
    canonicalOwner.toLowerCase() !== owner.toLowerCase() ||
    canonicalName.toLowerCase() !== repo.toLowerCase();

  const visibility: RepositoryRecord["visibility"] =
    data.visibility === "public"
      ? "public"
      : data.visibility === "private" || data.private
        ? "private"
        : data.visibility === "internal"
          ? "internal"
          : "unknown";

  const record: RepositoryRecord = {
    schemaVersion: 1,
    kind: "repository",
    host,
    owner: canonicalOwner,
    name: canonicalName,
    fullName: data.full_name,
    ...(data.node_id ? { nodeId: data.node_id } : {}),
    defaultBranch: data.default_branch,
    visibility,
    isArchived: data.archived,
    isDisabled: data.disabled,
    isFork: data.fork,
    webUrl: sanitizeUrl(data.html_url),
    canonicalUrlChanged,
    ...(canonicalUrlChanged ? { priorFullName: `${owner}/${repo}` } : {}),
    observedAt: new Date().toISOString(),
    completeness: "full",
  };

  return { ok: true, record };
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Strip any credentials (should never be present but defensive)
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
