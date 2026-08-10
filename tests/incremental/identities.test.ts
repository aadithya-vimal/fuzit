import { describe, expect, it } from "vitest";

import {
  createIndexIdentitySet,
  evaluateInvalidation,
  type IndexIdentityInput,
  type IndexSemanticVersions,
} from "@fuzit/index";

const input: IndexIdentityInput = {
  effectiveConfiguration: { maxFiles: 100, format: "json" },
  ignorePolicy: { rules: ["dist/**"] },
  securityPolicy: { version: 1, sensitive: [".env"] },
  parser: { typescript: "1" },
  analysis: { extractor: "1" },
  graph: { schemaVersion: 1 },
  schema: { incrementalIndex: 1 },
};

function state(
  identities = createIndexIdentitySet(input),
): IndexSemanticVersions {
  return {
    contentHash: "content",
    configHash: "config",
    scannerVersion: "scanner",
    parserVersion: "parser",
    securityPolicyVersion: "policy",
    schemaVersion: 1,
    identities,
  };
}

describe("incremental identity keys", () => {
  it("is deterministic across object key order", () => {
    const first = createIndexIdentitySet(input);
    const second = createIndexIdentitySet({
      ...input,
      effectiveConfiguration: { format: "json", maxFiles: 100 },
    });

    expect(second).toEqual(first);
    expect(first.schema).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  for (const [identity, affectedRecordTypes] of [
    ["effectiveConfiguration", ["file", "analysis", "graph"]],
    ["ignorePolicy", ["file", "analysis", "graph"]],
    ["securityPolicy", ["file", "analysis", "graph"]],
    ["parser", ["analysis", "graph"]],
    ["analysis", ["analysis", "graph"]],
    ["graph", ["graph"]],
    ["schema", ["file", "analysis", "graph"]],
  ] as const) {
    it(`explains a ${identity}-only change`, () => {
      const stored = state();
      const current = state({
        ...stored.identities!,
        [identity]: `sha256:${"f".repeat(64)}`,
      });

      expect(evaluateInvalidation(stored, current)).toEqual({
        valid: false,
        reasons: [`${identity} identity changed`],
        action: "rebuild",
        affectedRecordTypes,
      });
    });
  }

  it("reports an absent identity set as a bounded full invalidation", () => {
    const current = state();
    const stored = { ...current, identities: undefined };

    expect(evaluateInvalidation(stored, current)).toMatchObject({
      reasons: ["identity set changed"],
      affectedRecordTypes: ["file", "analysis", "graph"],
    });
  });
});
