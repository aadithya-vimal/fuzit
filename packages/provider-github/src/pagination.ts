/**
 * GitHub Link-header pagination, rate-limit state, ETag/Last-Modified
 * revalidation, and bounded retry behavior.
 *
 * @module
 */

import type { CredentialHandle } from "./auth.js";
import type { FixtureTransport, TransportResult } from "./transport.js";
import { githubRequest } from "./transport.js";

// ---------------------------------------------------------------------------
// Pagination cursor
// ---------------------------------------------------------------------------

export interface PaginationCursor {
  readonly schemaVersion: 1;
  readonly kind: "pagination-cursor";
  readonly nextUrl: string | null;
  readonly prevUrl: string | null;
  readonly lastUrl: string | null;
  readonly page: number;
  readonly totalPagesEstimate: number | null;
}

// ---------------------------------------------------------------------------
// Rate-limit state
// ---------------------------------------------------------------------------

export interface RateLimitState {
  readonly schemaVersion: 1;
  readonly kind: "rate-limit-state";
  readonly remaining: number | null;
  readonly limit: number | null;
  readonly resetEpochSeconds: number | null;
  readonly retryAfterSeconds: number | null;
  readonly isExhausted: boolean;
}

// ---------------------------------------------------------------------------
// Cache/revalidation state
// ---------------------------------------------------------------------------

export interface CacheState {
  readonly schemaVersion: 1;
  readonly kind: "cache-state";
  /** ETag for conditional GET (no token or auth metadata). */
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly bodyHash: string | null;
  readonly isStale: boolean;
  readonly lastObservedAt: string;
}

// ---------------------------------------------------------------------------
// Paginated fetch bounds
// ---------------------------------------------------------------------------

export interface PaginatedFetchBounds {
  /** Maximum pages to fetch. Default 10. Hard ceiling 100. */
  readonly maxPages: number;
  /** Maximum items per page. Default 100. Hard ceiling 100. */
  readonly perPage: number;
}

const DEFAULT_PAGE_BOUNDS: PaginatedFetchBounds = {
  maxPages: 10,
  perPage: 100,
};
const HARD_PAGE_CEILING = 100;

// ---------------------------------------------------------------------------
// Paginated result
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly cursor: PaginationCursor;
  readonly rateLimit: RateLimitState;
  readonly isComplete: boolean;
  readonly pagesConsumed: number;
  readonly partialReason: string | null;
}

// ---------------------------------------------------------------------------
// Link header parsing
// ---------------------------------------------------------------------------

export function parseLinkHeader(linkHeader: string | null | undefined): {
  next: string | null;
  prev: string | null;
  last: string | null;
} {
  if (!linkHeader) return { next: null, prev: null, last: null };
  const result: {
    next: string | null;
    prev: string | null;
    last: string | null;
  } = {
    next: null,
    prev: null,
    last: null,
  };
  for (const part of linkHeader.split(",")) {
    const match = part.trim().match(/<([^>]+)>;\s*rel="(\w+)"/);
    if (!match) continue;
    const url = match[1];
    const rel = match[2];
    if (url && rel === "next") result.next = url;
    else if (url && rel === "prev") result.prev = url;
    else if (url && rel === "last") result.last = url;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Rate limit extraction
// ---------------------------------------------------------------------------

export function extractRateLimit(
  headers: Record<string, string>,
  retryAfterSeconds?: number,
): RateLimitState {
  const remaining =
    headers["x-ratelimit-remaining"] != null
      ? Number.parseInt(headers["x-ratelimit-remaining"], 10)
      : null;
  const limit =
    headers["x-ratelimit-limit"] != null
      ? Number.parseInt(headers["x-ratelimit-limit"], 10)
      : null;
  const reset =
    headers["x-ratelimit-reset"] != null
      ? Number.parseInt(headers["x-ratelimit-reset"], 10)
      : null;
  const retryAfter =
    retryAfterSeconds ??
    (headers["retry-after"]
      ? Number.parseInt(headers["retry-after"], 10)
      : null);

  return {
    schemaVersion: 1,
    kind: "rate-limit-state",
    remaining: Number.isFinite(remaining) ? remaining : null,
    limit: Number.isFinite(limit) ? limit : null,
    resetEpochSeconds: Number.isFinite(reset) ? reset : null,
    retryAfterSeconds:
      retryAfter && Number.isFinite(retryAfter) ? retryAfter : null,
    isExhausted: remaining === 0,
  };
}

// ---------------------------------------------------------------------------
// ETag/cache state builder
// ---------------------------------------------------------------------------

export function buildCacheState(
  headers: Record<string, string>,
  isStale = false,
): CacheState {
  return {
    schemaVersion: 1,
    kind: "cache-state",
    etag: headers["etag"] ?? null,
    lastModified: headers["last-modified"] ?? null,
    bodyHash: null, // computed by consumer if needed
    isStale,
    lastObservedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Paginated fetch
// ---------------------------------------------------------------------------

export async function fetchAllPages<T>(
  startUrl: string,
  parseItems: (body: string) => T[],
  options: {
    readonly credential: CredentialHandle;
    readonly allowedHosts: readonly string[];
    readonly bounds?: Partial<PaginatedFetchBounds>;
    readonly fixtureTransport?: FixtureTransport;
    readonly etag?: string | null;
  },
): Promise<PaginatedResult<T>> {
  const maxPages = Math.min(
    options.bounds?.maxPages ?? DEFAULT_PAGE_BOUNDS.maxPages,
    HARD_PAGE_CEILING,
  );
  const perPage = Math.min(
    options.bounds?.perPage ?? DEFAULT_PAGE_BOUNDS.perPage,
    HARD_PAGE_CEILING,
  );

  const items: T[] = [];
  let nextUrl: string | null =
    `${startUrl}${startUrl.includes("?") ? "&" : "?"}per_page=${perPage}`;
  let pagesConsumed = 0;
  let lastRateLimit: RateLimitState = {
    schemaVersion: 1,
    kind: "rate-limit-state",
    remaining: null,
    limit: null,
    resetEpochSeconds: null,
    retryAfterSeconds: null,
    isExhausted: false,
  };
  let lastCursor: PaginationCursor = {
    schemaVersion: 1,
    kind: "pagination-cursor",
    nextUrl: null,
    prevUrl: null,
    lastUrl: null,
    page: 0,
    totalPagesEstimate: null,
  };
  let partialReason: string | null = null;

  while (nextUrl && pagesConsumed < maxPages) {
    const result: TransportResult = await githubRequest(
      nextUrl,
      options.fixtureTransport
        ? {
            allowedHosts: options.allowedHosts,
            credential: options.credential,
            fixtureTransport: options.fixtureTransport,
          }
        : {
            allowedHosts: options.allowedHosts,
            credential: options.credential,
          },
    );

    if (!result.ok) {
      if (result.kind === "rate-limited") {
        partialReason = `Rate limit reached after ${pagesConsumed} pages`;
        lastRateLimit = {
          ...lastRateLimit,
          isExhausted: true,
          retryAfterSeconds: result.retryAfterSeconds ?? null,
        };
      } else {
        partialReason = `Fetch failed after ${pagesConsumed} pages: ${result.diagnostic}`;
      }
      break;
    }

    // 304 Not Modified
    if (result.status === 304) {
      partialReason = "304 Not Modified — cached response still valid";
      break;
    }

    pagesConsumed++;
    lastRateLimit = extractRateLimit(result.headers);

    let pageItems: T[];
    try {
      pageItems = parseItems(result.body);
    } catch {
      partialReason = `JSON parse failed on page ${pagesConsumed}`;
      break;
    }
    items.push(...pageItems);

    const links = parseLinkHeader(result.headers["link"]);
    nextUrl = links.next;

    lastCursor = {
      schemaVersion: 1,
      kind: "pagination-cursor",
      nextUrl: links.next,
      prevUrl: links.prev,
      lastUrl: links.last,
      page: pagesConsumed,
      totalPagesEstimate: null,
    };
  }

  const reachedPageCeiling =
    !partialReason && nextUrl !== null && pagesConsumed >= maxPages;
  if (reachedPageCeiling) {
    partialReason = `Page ceiling reached (${maxPages} pages, results may be incomplete)`;
  }

  return {
    items,
    cursor: lastCursor,
    rateLimit: lastRateLimit,
    isComplete: partialReason === null && nextUrl === null,
    pagesConsumed,
    partialReason,
  };
}
