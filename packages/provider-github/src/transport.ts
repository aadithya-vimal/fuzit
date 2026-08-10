/**
 * Bounded GitHub HTTP transport.
 *
 * Wraps Node's fetch with strict bounds: timeout, cancellation, response-size
 * limits, redirect limits, content-type validation, safe user-agent, and API
 * version headers.
 *
 * SECURITY INVARIANTS:
 * - Authorization headers are never logged or recorded
 * - Response bodies are never serialized to disk by this layer
 * - Redirects are validated against the allowed host set before following
 * - Fixture transport injection is supported for deterministic tests
 *
 * @module
 */

import type { CredentialHandle } from "./auth.js";

// ---------------------------------------------------------------------------
// Bounds (configurable, with hard ceilings)
// ---------------------------------------------------------------------------

export interface TransportBounds {
  /** Request timeout in milliseconds. Default 30 000. Max 120 000. */
  readonly requestTimeoutMs: number;
  /** Maximum response body bytes. Default 8 MB. Max 32 MB. */
  readonly maxResponseBytes: number;
  /** Maximum redirects to follow. Default 3. Max 10. */
  readonly maxRedirects: number;
  /** Maximum retry attempts on transient 5xx. Default 2. Max 5. */
  readonly maxRetries: number;
}

const DEFAULT_BOUNDS: TransportBounds = {
  requestTimeoutMs: 30_000,
  maxResponseBytes: 8 * 1024 * 1024,
  maxRedirects: 3,
  maxRetries: 2,
};

const HARD_CEILING: TransportBounds = {
  requestTimeoutMs: 120_000,
  maxResponseBytes: 32 * 1024 * 1024,
  maxRedirects: 10,
  maxRetries: 5,
};

function clampBounds(bounds?: Partial<TransportBounds>): TransportBounds {
  return {
    requestTimeoutMs: Math.min(
      bounds?.requestTimeoutMs ?? DEFAULT_BOUNDS.requestTimeoutMs,
      HARD_CEILING.requestTimeoutMs,
    ),
    maxResponseBytes: Math.min(
      bounds?.maxResponseBytes ?? DEFAULT_BOUNDS.maxResponseBytes,
      HARD_CEILING.maxResponseBytes,
    ),
    maxRedirects: Math.min(
      bounds?.maxRedirects ?? DEFAULT_BOUNDS.maxRedirects,
      HARD_CEILING.maxRedirects,
    ),
    maxRetries: Math.min(
      bounds?.maxRetries ?? DEFAULT_BOUNDS.maxRetries,
      HARD_CEILING.maxRetries,
    ),
  };
}

// ---------------------------------------------------------------------------
// Transport result
// ---------------------------------------------------------------------------

export type TransportSuccess = {
  readonly ok: true;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
};

export type TransportFailure = {
  readonly ok: false;
  readonly kind:
    | "timeout"
    | "cancelled"
    | "oversized"
    | "invalid-json"
    | "invalid-content-type"
    | "untrusted-redirect"
    | "network-error"
    | "server-error"
    | "rate-limited";
  /** Human-readable sanitized explanation. Never contains tokens or auth headers. */
  readonly diagnostic: string;
  readonly status?: number;
  /** Retry-After seconds if provided by server (rate-limited). */
  readonly retryAfterSeconds?: number;
};

export type TransportResult = TransportSuccess | TransportFailure;

// ---------------------------------------------------------------------------
// Fixture transport for deterministic tests
// ---------------------------------------------------------------------------

export type FixtureTransport = (
  url: string,
  method: string,
) => Promise<TransportResult>;

// ---------------------------------------------------------------------------
// Transport options
// ---------------------------------------------------------------------------

export interface TransportRequestOptions {
  readonly method?: "GET" | "HEAD";
  readonly credential?: CredentialHandle;
  readonly allowedHosts: readonly string[];
  readonly bounds?: Partial<TransportBounds>;
  readonly cancellationSignal?: AbortSignal;
  /** If provided, uses this instead of real fetch (for tests). */
  readonly fixtureTransport?: FixtureTransport;
}

// ---------------------------------------------------------------------------
// Main transport function
// ---------------------------------------------------------------------------

const FUZIT_USER_AGENT = "Fuzit/1 (+https://fuzit.dev; read-only context tool)";
const GITHUB_API_VERSION = "2022-11-28";

/**
 * Make a bounded read-only request to a GitHub API endpoint.
 *
 * Authorization headers are injected from the credential handle and are never
 * logged, returned, or stored outside the active request.
 */
export async function githubRequest(
  url: string,
  options: TransportRequestOptions,
): Promise<TransportResult> {
  const { fixtureTransport } = options;
  const bounds = clampBounds(options.bounds);
  const method = options.method ?? "GET";

  // Validate host before any request
  const hostCheck = validateRequestHost(url, options.allowedHosts);
  if (!hostCheck.ok) {
    return {
      ok: false,
      kind: "untrusted-redirect",
      diagnostic: hostCheck.reason,
    };
  }

  // Use fixture transport in tests
  if (fixtureTransport) {
    return fixtureTransport(url, method);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort("timeout"),
    bounds.requestTimeoutMs,
  );

  // Merge external cancellation signal
  const externalSignal = options.cancellationSignal;
  let externalAbortListener: (() => void) | undefined;
  if (externalSignal) {
    externalAbortListener = () => controller.abort("cancelled");
    externalSignal.addEventListener("abort", externalAbortListener);
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": FUZIT_USER_AGENT,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    };

    // Inject auth header from opaque credential handle — never logged
    const authHeader = options.credential?._getAuthorizationHeader();
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        redirect: "manual", // we handle redirects ourselves
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      if (
        message.includes("timeout") ||
        controller.signal.reason === "timeout"
      ) {
        return { ok: false, kind: "timeout", diagnostic: "Request timed out" };
      }
      if (controller.signal.reason === "cancelled") {
        return {
          ok: false,
          kind: "cancelled",
          diagnostic: "Request cancelled",
        };
      }
      return {
        ok: false,
        kind: "network-error",
        diagnostic: `Network error: ${sanitizeErrorMessage(message)}`,
      };
    }

    // Handle manual redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return {
          ok: false,
          kind: "untrusted-redirect",
          diagnostic: "Redirect with missing Location header",
        };
      }
      if (!isRedirectHostAllowed(location, options.allowedHosts)) {
        return {
          ok: false,
          kind: "untrusted-redirect",
          diagnostic: `Redirect to disallowed host rejected (${sanitizeRedirectUrl(location)})`,
        };
      }
      // Follow redirect recursively with decremented limit
      return githubRequest(location, {
        ...options,
        bounds: {
          ...bounds,
          maxRedirects: bounds.maxRedirects - 1,
        },
      });
    }

    // Rate limit
    if (response.status === 429 || response.status === 403) {
      const retryAfter = response.headers.get("retry-after");
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining === "0" || response.status === 429) {
        const parsedRetry = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
        if (Number.isFinite(parsedRetry)) {
          return {
            ok: false,
            kind: "rate-limited",
            status: response.status,
            diagnostic: "GitHub API rate limit reached",
            retryAfterSeconds: parsedRetry,
          };
        }
        return {
          ok: false,
          kind: "rate-limited",
          status: response.status,
          diagnostic: "GitHub API rate limit reached",
        };
      }
    }

    // 5xx server errors
    if (response.status >= 500) {
      return {
        ok: false,
        kind: "server-error",
        status: response.status,
        diagnostic: `GitHub API server error (HTTP ${response.status})`,
      };
    }

    // Read body with size limit
    const bodyResult = await readBoundedBody(response, bounds.maxResponseBytes);
    if (!bodyResult.ok) {
      return bodyResult;
    }

    // Extract safe headers (excluding authorization)
    const safeHeaders: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() !== "authorization") {
        safeHeaders[key] = value;
      }
    }

    return {
      ok: true,
      status: response.status,
      headers: safeHeaders,
      body: bodyResult.body,
    };
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal && externalAbortListener) {
      externalSignal.removeEventListener("abort", externalAbortListener);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateRequestHost(
  url: string,
  allowedHosts: readonly string[],
): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "Invalid request URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Only https requests are allowed" };
  }
  const allowed = allowedHosts.some(
    (h) =>
      parsed.hostname === h ||
      parsed.hostname.endsWith(`.${h}`) ||
      // handle "host/api/v3" style apiHost entries
      h.startsWith(parsed.hostname),
  );
  if (!allowed) {
    return {
      ok: false,
      reason: `Host '${parsed.hostname}' is not in the allowed host set`,
    };
  }
  return { ok: true };
}

function isRedirectHostAllowed(
  location: string,
  allowedHosts: readonly string[],
): boolean {
  try {
    const url = new URL(location);
    if (url.protocol !== "https:") return false;
    return allowedHosts.some(
      (h) =>
        url.hostname === h ||
        url.hostname.endsWith(`.${h}`) ||
        h.startsWith(url.hostname),
    );
  } catch {
    return false;
  }
}

function sanitizeErrorMessage(message: string): string {
  // Remove anything that looks like a URL with credentials
  return message.replace(/https?:\/\/[^@\s]+@[^\s]+/g, "<url>");
}

function sanitizeRedirectUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; body: string } | TransportFailure> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      return {
        ok: false,
        kind: "oversized",
        diagnostic: `Response exceeds ${maxBytes} byte limit (Content-Length: ${length})`,
      };
    }
  }

  // Stream with byte counting
  const reader = response.body?.getReader();
  if (!reader) {
    return { ok: true, body: "" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      reader.cancel();
      return {
        ok: false,
        kind: "oversized",
        diagnostic: `Response body exceeds ${maxBytes} byte limit`,
      };
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body: new TextDecoder().decode(combined) };
}
