/**
 * Tests for pagination, rate limits, revalidation (GH-008).
 */

import { describe, it } from "vitest";
import { expect } from "vitest";
import {
  fetchAllPages,
  parseLinkHeader,
  extractRateLimit,
  resolveCredential,
} from "@fuzit/provider-github";

const cred = resolveCredential({ host: "github.com", env: {} });
const ALLOWED = ["github.com", "api.github.com"];

describe("GH-008: pagination and rate limits", () => {
  it("multi-page response collects all items", async () => {
    let call = 0;
    const result = await fetchAllPages<string>(
      "https://api.github.com/items",
      (body) => JSON.parse(body) as string[],
      {
        credential: cred,
        allowedHosts: ALLOWED,
        fixtureTransport: async () => {
          call++;
          if (call === 1) {
            return {
              ok: true,
              status: 200,
              headers: {
                "content-type": "application/json",
                link: '<https://api.github.com/items?page=2>; rel="next"',
              },
              body: JSON.stringify(["a", "b"]),
            };
          }
          return {
            ok: true,
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(["c"]),
          };
        },
      },
    );
    expect(result.items).toEqual(["a", "b", "c"]);
    expect(result.isComplete).toBe(true);
    expect(result.pagesConsumed).toBe(2);
  });

  it("page ceiling produces partial result", async () => {
    const result = await fetchAllPages<string>(
      "https://api.github.com/items",
      (body) => JSON.parse(body) as string[],
      {
        credential: cred,
        allowedHosts: ALLOWED,
        bounds: { maxPages: 1 },
        fixtureTransport: async () => ({
          ok: true,
          status: 200,
          headers: {
            link: '<https://api.github.com/items?page=2>; rel="next"',
          },
          body: JSON.stringify(["a", "b"]),
        }),
      },
    );
    expect(result.isComplete).toBe(false);
    expect(result.partialReason).toMatch(/ceiling/i);
    expect(result.pagesConsumed).toBe(1);
  });

  it("304 revalidation stops pagination", async () => {
    const result = await fetchAllPages<string>(
      "https://api.github.com/items",
      (body) => JSON.parse(body) as string[],
      {
        credential: cred,
        allowedHosts: ALLOWED,
        fixtureTransport: async () => ({
          ok: true,
          status: 304,
          headers: {},
          body: "",
        }),
      },
    );
    expect(result.pagesConsumed).toBe(0);
    expect(result.partialReason).toMatch(/304/);
  });

  it("primary rate limit exhausted produces partial", async () => {
    const result = await fetchAllPages<string>(
      "https://api.github.com/items",
      (body) => JSON.parse(body) as string[],
      {
        credential: cred,
        allowedHosts: ALLOWED,
        fixtureTransport: async () => ({
          ok: false,
          kind: "rate-limited" as const,
          status: 429,
          diagnostic: "Rate limit reached",
          retryAfterSeconds: 30,
        }),
      },
    );
    expect(result.isComplete).toBe(false);
    expect(result.rateLimit.isExhausted).toBe(true);
    expect(result.rateLimit.retryAfterSeconds).toBe(30);
  });

  it("secondary limit/Retry-After header parsed", () => {
    const state = extractRateLimit({
      "x-ratelimit-remaining": "0",
      "x-ratelimit-limit": "60",
      "retry-after": "45",
    });
    expect(state.isExhausted).toBe(true);
    expect(state.retryAfterSeconds).toBe(45);
  });

  it("cancellation between pages (fixture simulates)", async () => {
    let call = 0;
    const result = await fetchAllPages<string>(
      "https://api.github.com/items",
      (body) => JSON.parse(body) as string[],
      {
        credential: cred,
        allowedHosts: ALLOWED,
        fixtureTransport: async () => {
          call++;
          if (call === 1) {
            return {
              ok: true,
              status: 200,
              headers: {
                link: '<https://api.github.com/items?page=2>; rel="next"',
              },
              body: JSON.stringify(["x"]),
            };
          }
          return {
            ok: false,
            kind: "cancelled" as const,
            diagnostic: "Request cancelled",
          };
        },
      },
    );
    expect(result.items).toEqual(["x"]);
    expect(result.isComplete).toBe(false);
    expect(result.partialReason).toMatch(/Fetch failed/);
  });
});

describe("parseLinkHeader", () => {
  it("parses next and last", () => {
    const links = parseLinkHeader(
      '<https://a.com/page2>; rel="next", <https://a.com/page5>; rel="last"',
    );
    expect(links.next).toBe("https://a.com/page2");
    expect(links.last).toBe("https://a.com/page5");
    expect(links.prev).toBe(null);
  });

  it("returns all null for empty header", () => {
    const links = parseLinkHeader(null);
    expect(links.next).toBe(null);
  });
});
