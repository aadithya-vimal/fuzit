/**
 * Provider network policy contracts.
 *
 * Defines deny-by-default network authorization for GitHub operations.
 * Local-only commands must perform zero network calls.
 *
 * @module
 */

import type { SourceRef } from "./source-ref.js";

// ---------------------------------------------------------------------------
// Authorization reasons
// ---------------------------------------------------------------------------

export type NetworkAuthorizationReason =
  | "source-is-github-url"
  | "source-is-github-pr"
  | "source-is-github-issue"
  | "command-is-review"
  | "command-is-pr"
  | "command-is-issue"
  | "command-is-provider"
  | "explicit-enrichment-option";

export type NetworkDenialReason =
  | "local-source-no-enrichment"
  | "unsupported-host"
  | "unrelated-redirect"
  | "enterprise-host-not-configured";

// ---------------------------------------------------------------------------
// Network policy result
// ---------------------------------------------------------------------------

export type NetworkPolicyResult =
  | {
      readonly authorized: true;
      readonly reason: NetworkAuthorizationReason;
      /** Exact set of hosts allowed. Never contains tokens or credentials. */
      readonly allowedHosts: readonly string[];
    }
  | {
      readonly authorized: false;
      readonly reason: NetworkDenialReason;
      /** Human-readable explanation safe to show in diagnostics. */
      readonly explanation: string;
    };

// ---------------------------------------------------------------------------
// Command context that triggers authorization
// ---------------------------------------------------------------------------

export type ProviderCommand =
  "review" | "pr" | "issue" | "provider" | "context" | "scan";

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the network policy for a given source and command context.
 *
 * Returns an authorized result with allowed hosts, or a denied result with
 * an explanation. Never contacts the network. Never includes tokens.
 */
export function evaluateNetworkPolicy(
  source: SourceRef,
  command: ProviderCommand,
  options?: {
    /** The user has explicitly requested GitHub enrichment for a local source. */
    readonly explicitEnrichment?: boolean;
    /** Allowed enterprise host set from configuration. */
    readonly allowedEnterpriseHosts?: readonly string[];
  },
): NetworkPolicyResult {
  const { explicitEnrichment = false, allowedEnterpriseHosts = [] } =
    options ?? {};

  // Remote GitHub sources always authorize network
  if (source.kind === "github-repository") {
    const hosts = buildAllowedHosts(source.host.webHost, source.host.apiHost);
    if (
      source.host.isEnterprise &&
      !isEnterpriseHostAllowed(source.host.webHost, allowedEnterpriseHosts)
    ) {
      return {
        authorized: false,
        reason: "enterprise-host-not-configured",
        explanation: `GitHub Enterprise host '${source.host.webHost}' is not in the configured allow list. Add it to your Fuzit configuration.`,
      };
    }
    return {
      authorized: true,
      reason: "source-is-github-url",
      allowedHosts: hosts,
    };
  }

  if (source.kind === "github-pull-request") {
    if (
      source.host.isEnterprise &&
      !isEnterpriseHostAllowed(source.host.webHost, allowedEnterpriseHosts)
    ) {
      return {
        authorized: false,
        reason: "enterprise-host-not-configured",
        explanation: `GitHub Enterprise host '${source.host.webHost}' is not in the configured allow list.`,
      };
    }
    return {
      authorized: true,
      reason: "source-is-github-pr",
      allowedHosts: buildAllowedHosts(source.host.webHost, source.host.apiHost),
    };
  }

  if (source.kind === "github-issue") {
    if (
      source.host.isEnterprise &&
      !isEnterpriseHostAllowed(source.host.webHost, allowedEnterpriseHosts)
    ) {
      return {
        authorized: false,
        reason: "enterprise-host-not-configured",
        explanation: `GitHub Enterprise host '${source.host.webHost}' is not in the configured allow list.`,
      };
    }
    return {
      authorized: true,
      reason: "source-is-github-issue",
      allowedHosts: buildAllowedHosts(source.host.webHost, source.host.apiHost),
    };
  }

  // Local source: deny by default unless explicit command or enrichment
  if (source.kind === "local") {
    if (command === "review") {
      return {
        authorized: true,
        reason: "command-is-review",
        allowedHosts: ["github.com", "api.github.com"],
      };
    }
    if (command === "pr") {
      return {
        authorized: true,
        reason: "command-is-pr",
        allowedHosts: ["github.com", "api.github.com"],
      };
    }
    if (command === "issue") {
      return {
        authorized: true,
        reason: "command-is-issue",
        allowedHosts: ["github.com", "api.github.com"],
      };
    }
    if (command === "provider") {
      return {
        authorized: true,
        reason: "command-is-provider",
        allowedHosts: ["github.com", "api.github.com"],
      };
    }
    if (explicitEnrichment) {
      return {
        authorized: true,
        reason: "explicit-enrichment-option",
        allowedHosts: ["github.com", "api.github.com"],
      };
    }
    return {
      authorized: false,
      reason: "local-source-no-enrichment",
      explanation:
        "Local repository operations do not contact GitHub by default. Use a GitHub URL, or pass --enrich-github for explicit enrichment.",
    };
  }

  // Unreachable for well-typed SourceRef, but kept for safety
  return {
    authorized: false,
    reason: "unsupported-host",
    explanation: "Unrecognized source kind; network access is denied.",
  };
}

/**
 * Validate that a redirect target is within the allowed host set.
 * Returns false for any redirect to an unrelated host.
 */
export function isRedirectAllowed(
  redirectUrl: string,
  allowedHosts: readonly string[],
): boolean {
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return allowedHosts.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAllowedHosts(
  webHost: string,
  apiHost: string,
): readonly string[] {
  const hosts = new Set<string>();
  hosts.add(webHost);
  // apiHost may be "api.github.com" or "host/api/v3" — extract the hostname
  try {
    const url = new URL(`https://${apiHost}`);
    hosts.add(url.hostname);
  } catch {
    // apiHost already normalized
    const firstSeg = apiHost.split("/")[0];
    if (firstSeg) hosts.add(firstSeg);
  }
  return [...hosts];
}

function isEnterpriseHostAllowed(
  host: string,
  allowedEnterpriseHosts: readonly string[],
): boolean {
  return allowedEnterpriseHosts.some((h) => h === host);
}
