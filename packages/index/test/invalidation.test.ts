import { describe, expect, it } from "vitest";

import { describePurgeScope, evaluateInvalidation } from "../src/index.js";

const version = {
  contentHash: "content",
  configHash: "config",
  scannerVersion: "scanner",
  parserVersion: "parser",
  securityPolicyVersion: "policy",
  schemaVersion: 1,
};

describe("index invalidation", () => {
  for (const [name, change] of [
    ["version change", { scannerVersion: "scanner-2" }],
    ["config change", { configHash: "config-2" }],
    ["policy change", { securityPolicyVersion: "policy-2" }],
  ] as const) {
    it(name, () => {
      expect(
        evaluateInvalidation(version, { ...version, ...change }),
      ).toMatchObject({
        valid: false,
        action: "rebuild",
        affectedRecordTypes: ["file", "analysis", "graph"],
      });
    });
  }
  it("invalidates corruption", () => {
    expect(
      evaluateInvalidation(version, version, { corrupt: true }).valid,
    ).toBe(false);
  });
  it("gives concurrent rebuild callers the same deterministic decision", () => {
    expect(evaluateInvalidation(version, version)).toEqual(
      evaluateInvalidation(version, version),
    );
  });
  it("restricts purge scope to the exact owned directory", () => {
    expect(describePurgeScope("/cache/repo", "/cache").allowed).toBe(false);
    expect(describePurgeScope("/cache/repo", "/cache/repo").allowed).toBe(true);
  });
});
