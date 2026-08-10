/**
 * Provider-neutral source reference contracts.
 *
 * These types represent the normalized source references consumed by the
 * application layer. GitHub REST shapes and endpoint details are private to
 * `packages/provider-github` and must never appear here.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Source kinds
// ---------------------------------------------------------------------------

/** A local filesystem path that Fuzit will scan directly. */
export type LocalSourceKind = "local";

/** A remote GitHub repository (github.com or GitHub Enterprise). */
export type GitHubRepositorySourceKind = "github-repository";

/** A GitHub pull request. */
export type GitHubPullRequestSourceKind = "github-pull-request";

/** A GitHub issue. */
export type GitHubIssueSourceKind = "github-issue";

export type SourceKind =
  | LocalSourceKind
  | GitHubRepositorySourceKind
  | GitHubPullRequestSourceKind
  | GitHubIssueSourceKind;

// ---------------------------------------------------------------------------
// GitHub host identity
// ---------------------------------------------------------------------------

/**
 * Identifies a GitHub or GitHub Enterprise host.
 *
 * `webHost` is the canonical web/clone host (e.g. `github.com`).
 * `apiHost` is the REST API host. For github.com this is `api.github.com`.
 * For GitHub Enterprise it is typically `<webHost>/api/v3` or a configured
 * override.
 */
export interface GitHubHostIdentity {
  /** Web and clone host. Never contains credentials. */
  readonly webHost: string;
  /** REST API host (never contains credentials). */
  readonly apiHost: string;
  /** True when this is a GitHub Enterprise (non-github.com) host. */
  readonly isEnterprise: boolean;
}

// ---------------------------------------------------------------------------
// Local source reference
// ---------------------------------------------------------------------------

export interface LocalSourceRef {
  readonly kind: LocalSourceKind;
  /** Absolute filesystem path. */
  readonly path: string;
}

// ---------------------------------------------------------------------------
// GitHub source references
// ---------------------------------------------------------------------------

/**
 * Identifies a GitHub repository without credentials.
 *
 * All fields are derived from parsing the user-supplied input; no network
 * contact occurs during construction.
 */
export interface GitHubRepositoryRef {
  readonly kind: GitHubRepositorySourceKind;
  readonly host: GitHubHostIdentity;
  /** GitHub owner (user or organization). */
  readonly owner: string;
  /** Repository name. */
  readonly repo: string;
  /**
   * Explicit revision (branch, tag, or full SHA). Omitted when the caller
   * intends to use the repository's default branch.
   */
  readonly revision?: string;
}

/**
 * A GitHub pull request identified without credentials.
 */
export interface GitHubPullRequestRef {
  readonly kind: GitHubPullRequestSourceKind;
  readonly host: GitHubHostIdentity;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

/**
 * A GitHub issue identified without credentials.
 */
export interface GitHubIssueRef {
  readonly kind: GitHubIssueSourceKind;
  readonly host: GitHubHostIdentity;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

export type GitHubSourceRef =
  GitHubRepositoryRef | GitHubPullRequestRef | GitHubIssueRef;

export type RemoteSourceRef = GitHubSourceRef;

export type SourceRef = LocalSourceRef | RemoteSourceRef;

// ---------------------------------------------------------------------------
// Parse result types
// ---------------------------------------------------------------------------

export type ParseSourceRefSuccess<T extends SourceRef = SourceRef> = {
  readonly ok: true;
  readonly ref: T;
};

export type ParseSourceRefFailure = {
  readonly ok: false;
  /** Human-readable explanation of why parsing failed. Never contains secrets. */
  readonly reason: string;
};

export type ParseSourceRefResult<T extends SourceRef = SourceRef> =
  ParseSourceRefSuccess<T> | ParseSourceRefFailure;

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const SOURCE_REF_SCHEMA_VERSION = 1 as const;
