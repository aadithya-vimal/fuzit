/**
 * @fuzit/provider-github public surface.
 *
 * GitHub REST response shapes and endpoint details remain private to this
 * package. Only normalized `SourceRef` values and provider contracts cross
 * the package boundary.
 */

export {
  parseGitHubUrl,
  parseOwnerRepo,
  parseOwnerRepoHash,
  parseNumericWithRepo,
  resolveHost,
  isValidOwnerOrRepo,
  GITHUB_COM_WEB_HOST,
  GITHUB_COM_API_HOST,
} from "./source-parser.js";

export {
  resolveCredential,
  describeCredential,
  assertNoTokenInObject,
  type CredentialHandle,
  type CredentialSource,
  type ResolveCredentialOptions,
} from "./auth.js";

export {
  githubRequest,
  type TransportBounds,
  type TransportResult,
  type TransportSuccess,
  type TransportFailure,
  type TransportRequestOptions,
  type FixtureTransport,
} from "./transport.js";

export {
  resolveCapabilities,
  anonymousCapabilities,
  type ProviderCapabilityRecord,
  type RecordCapability,
  type CapabilityState,
  type ProviderRecordType,
} from "./capabilities.js";

export {
  resolveRepository,
  type RepositoryRecord,
  type ResolveRepositoryResult,
} from "./repository.js";

export {
  fetchAllPages,
  parseLinkHeader,
  extractRateLimit,
  buildCacheState,
  type PaginationCursor,
  type RateLimitState,
  type CacheState,
  type PaginatedResult,
  type PaginatedFetchBounds,
} from "./pagination.js";

export { normalizePullRequestData } from "./pr-ingest.js";

export { normalizePrFile } from "./pr-files-ingest.js";

export {
  normalizeReview,
  groupReviewCommentsIntoThreads,
} from "./reviews-ingest.js";

export { normalizeCheckRun, normalizeCommitStatus } from "./checks-ingest.js";

export { normalizeIssue, normalizeIssueComment } from "./issue-ingest.js";

export { createTombstone } from "./lifecycle.js";

export {
  buildEnterpriseHostIdentity,
  type EnterpriseHostConfig,
} from "./enterprise.js";
