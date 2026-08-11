/**
 * GitHub authentication broker.
 *
 * Resolves opaque credential handles from the environment without storing,
 * logging, serializing, or exposing tokens. Supports anonymous, FUZIT_GITHUB_TOKEN,
 * and GH_TOKEN (lower priority fallback) authentication.
 *
 * SECURITY INVARIANTS:
 * - Token strings never appear in return values, errors, or diagnostics
 * - Only an opaque credential handle crosses API boundaries
 * - Tokens are read from env, used, and released — never cached to disk
 * - No CLI --token argument is supported
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Credential handle (opaque)
// ---------------------------------------------------------------------------

/**
 * An opaque credential handle. The actual token string is captured in the
 * closure and never exposed through any property.
 *
 * Consumers pass this to HTTP transport and Git adapters via a getter that
 * returns the Authorization header value. The header value itself is only
 * materialized inside the transport layer.
 */
export interface CredentialHandle {
  /** Whether this is an authenticated (non-anonymous) credential. */
  readonly isAuthenticated: boolean;
  /**
   * Resolved host scope. For github.com this is 'github.com'.
   * For GitHub Enterprise this is the configured host.
   */
  readonly host: string;
  /**
   * Source of the credential for diagnostic purposes.
   * Never includes the token value itself.
   */
  readonly source: CredentialSource;
  /**
   * Produce the Authorization header value for an outgoing request.
   * This method must only be called from within the bounded HTTP transport.
   * @internal
   */
  readonly _getAuthorizationHeader: () => string | null;
}

export type CredentialSource =
  | "anonymous"
  | "FUZIT_GITHUB_TOKEN"
  | "GH_TOKEN"
  | "github-cli"
  | "host-specific";

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

export interface ResolveCredentialOptions {
  /** The GitHub/GHE host being accessed. */
  readonly host: string;
  /**
   * Environment variable map. Defaults to process.env.
   * Accept an explicit map in tests to avoid coupling to process state.
   */
  readonly env?: Record<string, string | undefined>;
}

/**
 * Resolve credentials for the given host without contacting the network.
 *
 * Priority order:
 * 1. `FUZIT_GITHUB_TOKEN` — highest priority Fuzit-specific token
 * 2. `GH_TOKEN` — lower priority compatibility source
 * 3. Anonymous — public access only
 *
 * The returned handle's `_getAuthorizationHeader` is the only way to obtain
 * the raw Authorization header. It must never be called outside the HTTP
 * transport layer.
 */
export function resolveCredential(
  options: ResolveCredentialOptions,
): CredentialHandle {
  const procEnv = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const env = options.env ?? procEnv ?? {};
  const host = options.host;

  // FUZIT_GITHUB_TOKEN takes highest priority
  const fuzitToken = env["FUZIT_GITHUB_TOKEN"];
  if (fuzitToken && fuzitToken.length > 0) {
    const captured = fuzitToken;
    return {
      isAuthenticated: true,
      host,
      source: "FUZIT_GITHUB_TOKEN",
      _getAuthorizationHeader: () => `Bearer ${captured}`,
    };
  }

  // GH_TOKEN as lower-priority fallback
  const ghToken = env["GH_TOKEN"];
  if (ghToken && ghToken.length > 0) {
    const captured = ghToken;
    return {
      isAuthenticated: true,
      host,
      source: "GH_TOKEN",
      _getAuthorizationHeader: () => `Bearer ${captured}`,
    };
  }

  // Anonymous
  return {
    isAuthenticated: false,
    host,
    source: "anonymous",
    _getAuthorizationHeader: () => null,
  };
}

export async function resolveGitHubCliCredential(
  options: ResolveCredentialOptions,
): Promise<CredentialHandle | null> {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("gh", ["auth", "token", "--hostname", options.host], {
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  if (result.status !== 0) return null;
  const token = result.stdout.trim();
  if (!token) return null;
  const captured = token;
  return {
    isAuthenticated: true,
    host: options.host,
    source: "github-cli",
    _getAuthorizationHeader: () => `Bearer ${captured}`,
  };
}

export async function resolveBestGitHubCredential(
  options: ResolveCredentialOptions,
): Promise<CredentialHandle> {
  const direct = resolveCredential(options);
  if (direct.isAuthenticated) return direct;
  const cli = await resolveGitHubCliCredential(options);
  return cli ?? direct;
}

// ---------------------------------------------------------------------------
// Safe diagnostics (never includes token value)
// ---------------------------------------------------------------------------

/**
 * Returns a safe diagnostic string describing the credential state.
 * Never includes the actual token value, partial token, or any secret.
 */
export function describeCredential(handle: CredentialHandle): string {
  if (!handle.isAuthenticated) {
    return `anonymous access for ${handle.host}`;
  }
  return `authenticated access for ${handle.host} via ${handle.source}`;
}

/**
 * Validate that a serialized object does not contain token-shaped values.
 * Used in tests and diagnostics to enforce the no-token invariant.
 */
export function assertNoTokenInObject(obj: unknown, label: string): void {
  const serialized = JSON.stringify(obj) ?? "";
  // Common token patterns: GitHub PATs (ghp_), OAuth tokens, bearer values
  const tokenPatterns = [
    /ghp_[A-Za-z0-9]{20,}/,
    /Bearer\s+\S{10,}/i,
    /token\s+[A-Za-z0-9_-]{10,}/i,
  ];
  for (const pattern of tokenPatterns) {
    if (pattern.test(serialized)) {
      throw new Error(
        `Security violation: token-shaped value detected in ${label}`,
      );
    }
  }
}
