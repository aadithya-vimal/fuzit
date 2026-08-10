/**
 * GitHub provider capability record.
 *
 * Records what operations are safely available for a given host and
 * authentication state. Missing permissions are partial diagnostics, not fatal.
 *
 * @module
 */

import type { GitHubHostIdentity } from "@fuzit/schemas";
import { resolveCredential, type CredentialHandle } from "./auth.js";

// ---------------------------------------------------------------------------
// Supported record types and operations
// ---------------------------------------------------------------------------

export type ProviderRecordType =
  | "repository"
  | "ref"
  | "commit"
  | "comparison"
  | "pull-request"
  | "pull-request-file"
  | "review"
  | "review-comment"
  | "review-thread"
  | "issue"
  | "issue-comment"
  | "check-suite"
  | "check-run"
  | "commit-status"
  | "rate-limit"
  | "diagnostic";

export type CapabilityState = "available" | "unavailable" | "unknown";

export interface RecordCapability {
  readonly recordType: ProviderRecordType;
  readonly state: CapabilityState;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Provider capability record
// ---------------------------------------------------------------------------

export interface ProviderCapabilityRecord {
  readonly schemaVersion: 1;
  readonly host: GitHubHostIdentity;
  readonly isAuthenticated: boolean;
  readonly credentialSource: string;
  readonly capabilities: readonly RecordCapability[];
  readonly partial: boolean;
  readonly diagnostics: readonly string[];
}

// ---------------------------------------------------------------------------
// Capability resolution
// ---------------------------------------------------------------------------

/**
 * Resolve provider capabilities without contacting the network.
 *
 * Capabilities are determined from authentication state and known GitHub
 * API constraints. Missing issue/check permission is a partial diagnostic,
 * not a fatal error.
 */
export function resolveCapabilities(
  host: GitHubHostIdentity,
  credential: CredentialHandle,
  options?: {
    /** Known missing permissions (e.g. from a prior 403). */
    readonly missingPermissions?: readonly ProviderRecordType[];
  },
): ProviderCapabilityRecord {
  const missing = new Set(options?.missingPermissions ?? []);
  const diagnostics: string[] = [];

  function cap(recordType: ProviderRecordType): RecordCapability {
    if (missing.has(recordType)) {
      diagnostics.push(
        `Permission denied for '${recordType}' on ${host.webHost} (authenticated: ${credential.isAuthenticated})`,
      );
      return { recordType, state: "unavailable", reason: "permission-denied" };
    }
    // Without authentication, private resources are unavailable
    if (!credential.isAuthenticated) {
      if (
        recordType === "pull-request" ||
        recordType === "review" ||
        recordType === "review-comment"
      ) {
        return {
          recordType,
          state: "unknown",
          reason: "anonymous-access-may-be-limited",
        };
      }
    }
    return { recordType, state: "available" };
  }

  const ALL_RECORD_TYPES: ProviderRecordType[] = [
    "repository",
    "ref",
    "commit",
    "comparison",
    "pull-request",
    "pull-request-file",
    "review",
    "review-comment",
    "review-thread",
    "issue",
    "issue-comment",
    "check-suite",
    "check-run",
    "commit-status",
    "rate-limit",
    "diagnostic",
  ];

  const capabilities = ALL_RECORD_TYPES.map(cap);

  return {
    schemaVersion: 1,
    host,
    isAuthenticated: credential.isAuthenticated,
    credentialSource: credential.source,
    capabilities,
    partial: missing.size > 0,
    diagnostics,
  };
}

/**
 * Build a default anonymous capability record for a given host.
 */
export function anonymousCapabilities(
  host: GitHubHostIdentity,
): ProviderCapabilityRecord {
  const credential = resolveCredential({ host: host.webHost, env: {} });
  return resolveCapabilities(host, credential);
}
