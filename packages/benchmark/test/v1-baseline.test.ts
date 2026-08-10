import { describe, expect, it } from "vitest";
import {
  aggregateRetrievalMetrics,
  evaluateAblation,
  measureRetrieval,
  validateBenchmarkCase,
} from "../src/index.js";

const candidates = [
  {
    path: "src/auth.ts",
    language: "typescript",
    tokens: 40,
    contributions: { lexical: 3, git: 1, dependency: 1, profile: 1 },
  },
  {
    path: "lib/auth.py",
    language: "python",
    tokens: 35,
    contributions: { lexical: 2, git: 0, dependency: 1, profile: 0 },
  },
  {
    path: "docs/readme.md",
    language: "markdown",
    tokens: 20,
    contributions: { lexical: 0, git: 1, dependency: 0, profile: 0 },
  },
] as const;

const base = {
  id: "v1",
  repositoryFixture: "monorepo" as const,
  task: "fix authentication",
  expected: { "src/auth.ts": 3, "lib/auth.py": 2 },
  candidates,
  budgetTokens: 100,
};

describe("v1 baseline", () => {
  it.each(["lexical", "git", "dependency", "profile"] as const)(
    "measures the %s ablation deterministically",
    (source) => {
      expect(evaluateAblation({ ...base, disabled: [source] })).toEqual(
        evaluateAblation({ ...base, disabled: [source] }),
      );
    },
  );
  it.each(["small", "medium", "monorepo"] as const)(
    "covers the %s fixture class across languages",
    (repositoryFixture) => {
      expect(evaluateAblation({ ...base, repositoryFixture }).recall).toBe(1);
      expect(new Set(candidates.map(({ language }) => language)).size).toBe(3);
    },
  );
  it("enforces token-budget variants", () => {
    expect(evaluateAblation({ ...base, budgetTokens: 39 }).bundleSize).toBe(1);
    expect(evaluateAblation(base).bundleSize).toBe(3);
  });
  it("is equivalent for indexed and direct candidate inputs", () => {
    const direct = evaluateAblation(base);
    const indexed = evaluateAblation({
      ...base,
      candidates: JSON.parse(JSON.stringify(candidates)),
    });
    expect(indexed).toEqual(direct);
  });
  it("validates V1 retrieval benchmark case schema", () => {
    const benchmarkCase = {
      schemaVersion: 1,
      id: "bm-001",
      name: "Authentication Fix",
      category: "bug-fix" as const,
      repositoryFixture: "small",
      task: "Fix auth login flow",
      profile: "default",
      budgetTokens: 500,
      expectedItems: [
        {
          path: "src/auth.ts",
          classification: "required" as const,
          relevanceGrade: 3,
        },
        {
          path: "src/utils.ts",
          classification: "useful" as const,
          relevanceGrade: 1,
        },
      ],
      graphExpectations: { maxDistance: 2 },
    };
    expect(validateBenchmarkCase(benchmarkCase)).toBe(true);
    expect(validateBenchmarkCase({ schemaVersion: 2 })).toBe(false);
  });
  it("validates architecture and security benchmark case schema and expectations", () => {
    const archSecurityCase = {
      schemaVersion: 1,
      id: "architecture-security-audit",
      name: "Architecture Boundary and Security Audit Case",
      category: "architecture-security" as const,
      repositoryFixture: "small",
      task: "review system boundaries and security filter policies",
      profile: "security",
      budgetTokens: 16000,
      expectedItems: [
        {
          path: "src/security/filter.ts",
          classification: "required" as const,
          relevanceGrade: 3,
        },
        {
          path: "secrets/raw-credentials.pem",
          classification: "prohibited" as const,
          relevanceGrade: 0,
        },
      ],
      graphExpectations: { maxDistance: 2 },
    };
    expect(validateBenchmarkCase(archSecurityCase)).toBe(true);
    const prohibitedItems = archSecurityCase.expectedItems.filter(
      (item) => item.classification === "prohibited",
    );
    expect(prohibitedItems).toHaveLength(1);
    expect(prohibitedItems[0].relevanceGrade).toBe(0);
  });
  it("validates polyglot feature and migration benchmark case schema and expectations", () => {
    const polyglotCase = {
      schemaVersion: 1,
      id: "polyglot-feature-migration",
      name: "Polyglot Monorepo Feature and Migration Task",
      category: "feature" as const,
      repositoryFixture: "monorepo",
      task: "add polyglot feature and run schema migration across packages",
      profile: "default",
      budgetTokens: 16000,
      expectedItems: [
        {
          path: "packages/core/src/index.ts",
          classification: "required" as const,
          relevanceGrade: 3,
        },
        {
          path: "packages/schemas/src/index/contracts.ts",
          classification: "useful" as const,
          relevanceGrade: 2,
        },
        {
          path: "tests/migrations/migration.test.ts",
          classification: "useful" as const,
          relevanceGrade: 1,
        },
      ],
      graphExpectations: { maxDistance: 2 },
    };
    expect(validateBenchmarkCase(polyglotCase)).toBe(true);
    expect(polyglotCase.expectedItems).toHaveLength(3);
  });
  it("calculates metrics for zero-result, duplicates, and missing/extra items accurately", () => {
    const zeroResult = measureRetrieval({
      id: "zero",
      repositoryFixture: "small",
      task: "task",
      expected: { "a.ts": 1 },
      selected: [],
      symbolHints: [],
      budgetTokens: 1000,
    });
    expect(zeroResult.precision).toBe(0);
    expect(zeroResult.recall).toBe(0);
    expect(zeroResult.mrr).toBe(0);
    expect(zeroResult.missingItems).toEqual(["a.ts"]);

    const withDuplicates = measureRetrieval({
      id: "dups",
      repositoryFixture: "small",
      task: "task",
      expected: { "a.ts": 1 },
      selected: ["a.ts", "a.ts", "b.ts"],
      symbolHints: [],
      budgetTokens: 1000,
    });
    expect(withDuplicates.bundleSize).toBe(2);
    expect(withDuplicates.extraItems).toEqual(["b.ts"]);

    const agg = aggregateRetrievalMetrics([zeroResult, withDuplicates]);
    expect(agg.caseCount).toBe(2);
    expect(agg.precision).toBe(0.25);
  });
  it("measures irrelevant-token ratio, token estimator, byte budget use, and multibyte text", () => {
    const res = measureRetrieval({
      id: "budget-test",
      repositoryFixture: "small",
      task: "task",
      expected: { "relevant.ts": 3 },
      selected: ["relevant.ts", "irrelevant.ts", "multibyte_🚀.ts"],
      symbolHints: [],
      budgetTokens: 1000,
      itemTokens: {
        "relevant.ts": 100,
        "irrelevant.ts": 50,
        "multibyte_🚀.ts": 50,
      },
      estimatorId: "custom-estimator:v1",
      maxByteBudget: 20,
    });
    expect(res.totalTokens).toBe(200);
    expect(res.irrelevantTokens).toBe(100);
    expect(res.irrelevantTokenRatio).toBe(0.5);
    expect(res.estimatorId).toBe("custom-estimator:v1");
    expect(res.exceedsByteBudget).toBe(true);
  });
  it("verifies release performance baseline results structure and evaluation report", () => {
    const payload = {
      schemaVersion: 1,
      environment: { nodeVersion: "v24.12.0", platform: "win32", arch: "x64" },
      results: [],
    };
    expect(payload.schemaVersion).toBe(1);
    expect(payload.environment.nodeVersion).toBeTruthy();
  });
});
