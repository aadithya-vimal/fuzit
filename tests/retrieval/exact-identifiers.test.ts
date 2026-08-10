import { describe, expect, it } from "vitest";
import {
  normalizeIdentifierTokens,
  scoreExactIdentifiers,
} from "@fuzit/selection";

describe("exact identifier relevance", () => {
  it("normalizes case, Unicode, routes, schemas, packages, and aliases", () => {
    expect(normalizeIdentifierTokens("Cr\u00e9erHTTPClient")).toEqual([
      "cr\u00e9er",
      "httpclient",
    ]);
    const score = scoreExactIdentifiers("fix cr\u00e9er checkout", {
      symbols: ["Cr\u00e9er"],
      routes: ["/checkout/session"],
      schemas: ["CheckoutSession"],
      packages: ["@fuzit/payments"],
      aliases: ["checkout"],
    });
    expect(score.value).toBeCloseTo(2 / 3);
    expect(score.matchedTerms).toEqual(["cr\u00e9er", "checkout"]);
  });

  it("ranks exact anchors above incidental path text", () => {
    const exact = scoreExactIdentifiers("repair PaymentGateway", {
      symbols: ["PaymentGateway"],
    });
    const incidental = scoreExactIdentifiers("repair PaymentGateway", {
      paths: ["docs/payment-gateway-notes.md"],
    });
    expect(exact.value).toBeGreaterThan(incidental.value);
    expect(exact.basis).toContain("PaymentGateway");
  });

  it("does not promote common-name false positives", () => {
    expect(
      scoreExactIdentifiers("update main index file", {
        symbols: ["main", "index", "file"],
      }),
    ).toMatchObject({
      value: 0,
      matchedIdentifiers: [],
      matchedTerms: [],
    });
  });
});
