/**
 * GitHub source URL and shorthand parser.
 *
 * Parses all supported GitHub source forms into normalized `SourceRef` objects
 * without contacting the network. Credential-bearing URLs, unsupported schemes,
 * encoded path traversal, and non-GitHub hosts are rejected immediately.
 *
 * @module
 */

import type {
  GitHubHostIdentity,
  GitHubIssueRef,
  GitHubPullRequestRef,
  GitHubRepositoryRef,
  ParseSourceRefResult,
} from "@fuzit/schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_COM_WEB_HOST = "github.com";
const GITHUB_COM_API_HOST = "api.github.com";

/**
 * URL schemes that are supported for GitHub sources.
 * Only https is permitted; git+https and git+ssh are not supported as direct
 * source inputs (they are used internally for safe Git transport).
 */
const SUPPORTED_SCHEMES = new Set(["https:"]);

/**
 * Segments that indicate a credential might be embedded in the URL.
 */
const CREDENTIAL_INDICATORS = /[@:][^/]/;

// ---------------------------------------------------------------------------
// Host resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a `GitHubHostIdentity` from a parsed URL's hostname.
 *
 * For github.com the API host is `api.github.com`.
 * For a GitHub Enterprise host the API base is derived as
 * `<host>/api/v3` unless `apiBase` is explicitly overridden.
 *
 * This function performs no network calls.
 */
function resolveHost(
  hostname: string,
  apiBase?: string,
): GitHubHostIdentity | null {
  if (!hostname || hostname.length === 0) return null;
  // Reject IP addresses and localhost
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "localhost") {
    return null;
  }
  const isEnterprise = hostname !== GITHUB_COM_WEB_HOST;
  const apiHost = apiBase
    ? apiBase
    : isEnterprise
      ? `${hostname}/api/v3`
      : GITHUB_COM_API_HOST;
  return { webHost: hostname, apiHost, isEnterprise };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate an owner or repository name component.
 * GitHub allows letters, digits, hyphens, underscores, and dots.
 * Empty names, names starting with a hyphen, and names with double-dots are
 * rejected.
 */
function isValidOwnerOrRepo(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.startsWith("-")) return false;
  if (name.includes("..")) return false;
  if (name.includes("%")) return false; // encoded traversal
  return /^[\w.-]+$/.test(name);
}

/**
 * Validate a pull-request or issue number string.
 */
function parsePositiveInteger(s: string): number | null {
  if (!/^\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// ---------------------------------------------------------------------------
// URL-based parsers
// ---------------------------------------------------------------------------

/**
 * Parse a `https://HOST/OWNER/REPO[.git][/...]` URL.
 *
 * Supported path forms after `/OWNER/REPO`:
 *   - (empty or /) → repository
 *   - `/pull/N`    → pull request
 *   - `/issues/N`  → issue
 */
function parseGitHubUrl(
  input: string,
): ParseSourceRefResult<
  GitHubRepositoryRef | GitHubPullRequestRef | GitHubIssueRef
> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "input is not a valid URL" };
  }

  if (!SUPPORTED_SCHEMES.has(url.protocol)) {
    return {
      ok: false,
      reason: `unsupported URL scheme '${url.protocol}'; only https is allowed`,
    };
  }

  // Reject credentials embedded in the URL
  if (url.username || url.password) {
    return {
      ok: false,
      reason: "credentials must not be embedded in GitHub URLs",
    };
  }

  // Extra check on raw input for credential-like patterns before URL parsing
  // strips them (some environments normalise before throwing)
  const hostPart = input.slice("https://".length).split("/")[0] ?? "";
  if (CREDENTIAL_INDICATORS.test(hostPart)) {
    return {
      ok: false,
      reason: "credentials must not be embedded in GitHub URLs",
    };
  }

  const host = resolveHost(url.hostname);
  if (!host) {
    return {
      ok: false,
      reason: `unresolvable or disallowed GitHub host: ${url.hostname}`,
    };
  }

  // Reject hash fragments with non-trivial content that might indicate a
  // misrouted URL
  if (url.hash && url.hash.length > 1) {
    return {
      ok: false,
      reason:
        "URL fragments are ambiguous in GitHub source references; use a path-based revision",
    };
  }

  // Strip leading slash and optional .git suffix from pathname
  let pathname = url.pathname;
  if (pathname.endsWith(".git")) {
    pathname = pathname.slice(0, -4);
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    return {
      ok: false,
      reason: "GitHub URL must include at least OWNER and REPO path segments",
    };
  }

  const owner = segments[0];
  const repoRaw = segments[1];
  const rest = segments.slice(2);

  if (!owner || !isValidOwnerOrRepo(owner)) {
    return { ok: false, reason: `invalid GitHub owner: '${owner}'` };
  }
  if (!repoRaw || !isValidOwnerOrRepo(repoRaw)) {
    return {
      ok: false,
      reason: `invalid GitHub repository name: '${repoRaw}'`,
    };
  }

  // No further path → repository source
  if (rest.length === 0) {
    const ref: GitHubRepositoryRef = {
      kind: "github-repository",
      host,
      owner,
      repo: repoRaw,
    };
    return { ok: true, ref };
  }

  const firstRest = rest[0];
  const secondRest = rest[1];

  // Pull request: /pull/N
  if (firstRest === "pull" && rest.length === 2 && secondRest) {
    const number = parsePositiveInteger(secondRest);
    if (number === null) {
      return {
        ok: false,
        reason: `invalid pull request number: '${secondRest}'`,
      };
    }
    const ref: GitHubPullRequestRef = {
      kind: "github-pull-request",
      host,
      owner,
      repo: repoRaw,
      number,
    };
    return { ok: true, ref };
  }

  // Issue: /issues/N
  if (firstRest === "issues" && rest.length === 2 && secondRest) {
    const number = parsePositiveInteger(secondRest);
    if (number === null) {
      return { ok: false, reason: `invalid issue number: '${secondRest}'` };
    }
    const ref: GitHubIssueRef = {
      kind: "github-issue",
      host,
      owner,
      repo: repoRaw,
      number,
    };
    return { ok: true, ref };
  }

  // Tree/blob paths → treat as repository with revision context
  if (firstRest === "tree" && rest.length >= 2) {
    const ref: GitHubRepositoryRef = {
      kind: "github-repository",
      host,
      owner,
      repo: repoRaw,
      revision: rest.slice(1).join("/"),
    };
    return { ok: true, ref };
  }

  return {
    ok: false,
    reason: `unsupported GitHub URL path: '${url.pathname}'`,
  };
}

// ---------------------------------------------------------------------------
// Shorthand parsers
// ---------------------------------------------------------------------------

/**
 * Parse `OWNER/REPO` shorthand (github.com implied).
 */
function parseOwnerRepo(
  input: string,
): ParseSourceRefResult<GitHubRepositoryRef> {
  const parts = input.split("/");
  if (parts.length !== 2) {
    return {
      ok: false,
      reason: "OWNER/REPO must have exactly two slash-separated components",
    };
  }
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !isValidOwnerOrRepo(owner)) {
    return { ok: false, reason: `invalid owner: '${owner}'` };
  }
  if (!repo || !isValidOwnerOrRepo(repo)) {
    return { ok: false, reason: `invalid repository name: '${repo}'` };
  }
  const host = resolveHost(GITHUB_COM_WEB_HOST)!;
  return { ok: true, ref: { kind: "github-repository", host, owner, repo } };
}

/**
 * Parse `OWNER/REPO#N` shorthand with explicit PR/issue disambiguation.
 *
 * When `recordKind` is `"pull-request"` → `GitHubPullRequestRef`.
 * When `recordKind` is `"issue"` → `GitHubIssueRef`.
 * When omitted the parser rejects with an ambiguity error.
 */
function parseOwnerRepoHash(
  input: string,
  recordKind: "pull-request",
): ParseSourceRefResult<GitHubPullRequestRef>;
function parseOwnerRepoHash(
  input: string,
  recordKind: "issue",
): ParseSourceRefResult<GitHubIssueRef>;
function parseOwnerRepoHash(
  input: string,
  recordKind?: "pull-request" | "issue",
): ParseSourceRefResult<GitHubPullRequestRef | GitHubIssueRef>;
function parseOwnerRepoHash(
  input: string,
  recordKind?: "pull-request" | "issue",
): ParseSourceRefResult<GitHubPullRequestRef | GitHubIssueRef> {
  const hashIndex = input.indexOf("#");
  if (hashIndex === -1) {
    return { ok: false, reason: "OWNER/REPO#N must include a '#' separator" };
  }
  const repoPath = input.slice(0, hashIndex);
  const numberStr = input.slice(hashIndex + 1);

  const repoResult = parseOwnerRepo(repoPath);
  if (!repoResult.ok) return repoResult as ParseSourceRefResult<never>;

  const number = parsePositiveInteger(numberStr);
  if (number === null) {
    return { ok: false, reason: `invalid number after '#': '${numberStr}'` };
  }

  const { owner, repo, host } = repoResult.ref;

  if (!recordKind) {
    return {
      ok: false,
      reason:
        "OWNER/REPO#N is ambiguous without command context; use 'fuzit pr' or 'fuzit issue'",
    };
  }

  if (recordKind === "pull-request") {
    const ref: GitHubPullRequestRef = {
      kind: "github-pull-request",
      host,
      owner,
      repo,
      number,
    };
    return { ok: true, ref };
  }

  const ref: GitHubIssueRef = {
    kind: "github-issue",
    host,
    owner,
    repo,
    number,
  };
  return { ok: true, ref };
}

/**
 * Parse a numeric ID with an explicit `--repo OWNER/REPO` providing context.
 */
function parseNumericWithRepo(
  numberStr: string,
  repoStr: string,
  recordKind: "pull-request",
): ParseSourceRefResult<GitHubPullRequestRef>;
function parseNumericWithRepo(
  numberStr: string,
  repoStr: string,
  recordKind: "issue",
): ParseSourceRefResult<GitHubIssueRef>;
function parseNumericWithRepo(
  numberStr: string,
  repoStr: string,
  recordKind: "pull-request" | "issue",
): ParseSourceRefResult<GitHubPullRequestRef | GitHubIssueRef>;
function parseNumericWithRepo(
  numberStr: string,
  repoStr: string,
  recordKind: "pull-request" | "issue",
): ParseSourceRefResult<GitHubPullRequestRef | GitHubIssueRef> {
  const number = parsePositiveInteger(numberStr);
  if (number === null) {
    return { ok: false, reason: `invalid number: '${numberStr}'` };
  }
  const repoResult = parseOwnerRepo(repoStr);
  if (!repoResult.ok) return repoResult as ParseSourceRefResult<never>;
  const { owner, repo, host } = repoResult.ref;
  if (recordKind === "pull-request") {
    return {
      ok: true,
      ref: { kind: "github-pull-request", host, owner, repo, number },
    };
  }
  return {
    ok: true,
    ref: { kind: "github-issue", host, owner, repo, number },
  };
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export {
  parseGitHubUrl,
  parseOwnerRepo,
  parseOwnerRepoHash,
  parseNumericWithRepo,
  resolveHost,
  isValidOwnerOrRepo,
  GITHUB_COM_WEB_HOST,
  GITHUB_COM_API_HOST,
};
