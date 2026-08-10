import { describe, expect, it } from "vitest";

import { estimateBudget } from "../src/index.js";

describe("budget estimation", () => {
  it("accounts for ASCII bytes", () => {
    expect(estimateBudget("abcd")).toMatchObject({
      bytes: 4,
      estimatedTokens: 1,
    });
  });

  it("accounts for Unicode UTF-8 bytes", () => {
    expect(estimateBudget("🙂").bytes).toBe(4);
  });

  it("handles large content deterministically", () => {
    expect(estimateBudget("x".repeat(1_000_000)).estimatedTokens).toBe(250_000);
  });

  it("includes metadata overhead", () => {
    expect(estimateBudget("", { metadata: { path: "a" } })).toMatchObject({
      bytes: 12,
      metadataBytes: 12,
    });
  });

  it("supports a different named estimator", () => {
    expect(
      estimateBudget("abc", {
        estimator: {
          id: "characters:v1",
          uncertainty: 0.5,
          estimate: (content) => content.length,
        },
      }),
    ).toMatchObject({
      estimatedTokens: 3,
      estimator: "characters:v1",
      uncertainty: 0.5,
    });
  });

  it("reports a zero budget without division", () => {
    expect(estimateBudget("x", { maximumTokens: 0 }).exceedsBudget).toBe(true);
  });
});
