import { describe, expect, it } from "vitest";

import { detectAndRedactCredentials } from "../src/index.js";

function detected(content: string) {
  return detectAndRedactCredentials(content, "fixture.txt");
}

describe("credential detectors", () => {
  it("redacts synthetic API keys without retaining the match", () => {
    const value = ["SYNTHETIC", "SECRET", "VALUE", "123456"].join("_");
    const result = detected(`api_key=${value}`);
    expect(result.content).not.toContain(value);
    expect(JSON.stringify(result.findings)).not.toContain(value);
    expect(result.findings[0]?.kind).toBe("api-key");
  });

  it("redacts URLs with credentials", () => {
    const result = detected("https://user:password123@example.test/path");
    expect(result.findings[0]?.kind).toBe("url-credential");
    expect(result.content).not.toContain("password123");
  });

  it("redacts JWT-like values", () => {
    const jwt = "eyHeader12345.payload12345.signature12345";
    expect(detected(jwt).findings[0]?.kind).toBe("jwt");
  });

  it("redacts multiline private key blocks", () => {
    const value =
      "-----BEGIN PRIVATE KEY-----\nsynthetic-material\n-----END PRIVATE KEY-----";
    const result = detected(value);
    expect(result.findings[0]?.kind).toBe("private-key");
    expect(result.content).not.toContain("synthetic-material");
  });

  it("does not flag the false-positive corpus", () => {
    for (const value of [
      "https://example.test/path",
      "export const ordinaryName = true;",
      "short_identifier",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "550e8400-e29b-41d4-a716-446655440000",
      "this_is_a_long_but_ordinary_identifier_without_digits",
    ])
      expect(detected(value).findings).toHaveLength(0);
  });

  it("measures complete recall and bounded precision on the sanitized V1 corpus", () => {
    const positives = [
      'api_key=\n  "SyntheticSplitValue123456"',
      "authorization: Bearer SyntheticBearer.Value123456789",
      "-----BEGIN PRIVATE KEY-----\nSyntheticPrivateMaterial123\n-----END PRIVATE KEY-----",
      "-----BEGIN CERTIFICATE-----\nSyntheticCertificateMaterial123\n-----END CERTIFICATE-----",
      "Server=local.test;User Id=fixture;Password=SyntheticPassword123",
      "QWxwaGEyMzQ1Njc4OUJldGFHYW1tYQ==",
      "zK8vN2qP4mR7tY9wX3cB6dF1",
    ];
    const negatives = [
      "https://example.test/path",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "550e8400-e29b-41d4-a716-446655440000",
      "ordinary_identifier_without_a_secret",
    ];

    const truePositives = positives.filter(
      (value) => detected(value).findings.length > 0,
    ).length;
    const falsePositives = negatives.filter(
      (value) => detected(value).findings.length > 0,
    ).length;
    expect({
      recall: truePositives / positives.length,
      precision: truePositives / (truePositives + falsePositives),
    }).toEqual({
      recall: 1,
      precision: 1,
    });

    for (const raw of positives) {
      const result = detected(raw);
      expect(result.content).not.toContain(raw);
      expect(JSON.stringify(result.findings)).not.toContain(raw);
    }
  });
});
