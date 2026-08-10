import { describe, expect, it } from "vitest";
import {
  compareBaseline,
  measureRetrieval,
  type RetrievalCase,
} from "../src/index.js";

const base: RetrievalCase = {
  id: "auth",
  repositoryFixture: "fixtures/selection/lexical",
  task: "fix authentication failure",
  expected: { "authentication.ts": 3, "test.ts": 1 },
  selected: ["authentication.ts", "other.ts"],
  symbolHints: ["reportAuthenticationFailure"],
  budgetTokens: 16_000,
};

describe("retrieval benchmark", () => {
  it("measures expected sets and graded relevance", () => {
    expect(measureRetrieval(base)).toMatchObject({
      precision: 0.5,
      recall: 0.5,
      mrr: 1,
    });
    expect(measureRetrieval(base).ndcg).toBeGreaterThan(0.8);
  });
  it("defines empty relevance without division by zero", () => {
    expect(
      measureRetrieval({ ...base, expected: {}, selected: [] }),
    ).toMatchObject({
      precision: 0,
      recall: 1,
      ndcg: 1,
      mrr: 0,
      bundleSize: 0,
    });
  });
  it("supports budget variants as explicit case data", () => {
    expect(
      measureRetrieval({ ...base, budgetTokens: 1, selected: [] }).bundleSize,
    ).toBe(0);
  });
  it("is stable for repeated inputs", () => {
    expect(measureRetrieval(base)).toEqual(measureRetrieval(base));
  });
  it("detects baseline regressions", () => {
    const baseline = measureRetrieval(base);
    expect(
      compareBaseline({ ...baseline, recall: 0 }, baseline).regressed,
    ).toBe(true);
    expect(compareBaseline(baseline, baseline).regressed).toBe(false);
  });
});
