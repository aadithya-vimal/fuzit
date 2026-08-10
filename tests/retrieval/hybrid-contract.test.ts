import { describe, expect, it } from "vitest";
import {
  compareHybridScores,
  createHybridScore,
  serializeHybridScore,
  type HybridFeatureVector,
} from "@fuzit/selection";

const featureVector = (path = "src/a.ts"): HybridFeatureVector => ({
  schemaVersion: 1,
  candidateId: `candidate:${path}`,
  path,
  requiredAnchor: true,
  features: { lexical: 0.5, exact: 1 },
});

describe("hybrid scoring contract", () => {
  it("serializes and ranks identical inputs deterministically", () => {
    const input = {
      featureVector: featureVector(),
      profileId: "bug-fix",
      profileVersion: 1,
      weights: { lexical: 3, exact: 4 },
      basis: { lexical: "normalized task tokens", exact: "exact identifier" },
    };
    const first = createHybridScore(input);
    expect(serializeHybridScore(createHybridScore(input))).toBe(
      serializeHybridScore(first),
    );
    expect(first.aggregateScore).toBe(5.5);
    expect(first.featureVector.requiredAnchor).toBe(true);
    expect(
      [
        createHybridScore({ ...input, featureVector: featureVector("b.ts") }),
        createHybridScore({ ...input, featureVector: featureVector("a.ts") }),
      ].sort(compareHybridScores)[0]?.featureVector.path,
    ).toBe("a.ts");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite evidence %s",
    (value) => {
      expect(() =>
        createHybridScore({
          featureVector: {
            ...featureVector(),
            features: { lexical: value },
          },
          profileId: "bug-fix",
          profileVersion: 1,
          weights: { lexical: 1 },
          basis: { lexical: "tokens" },
        }),
      ).toThrow(/finite/u);
    },
  );

  it("rejects missing basis and unversioned evidence", () => {
    expect(() =>
      createHybridScore({
        featureVector: featureVector(),
        profileId: "bug-fix",
        profileVersion: 1,
        weights: {},
        basis: {},
      }),
    ).toThrow(/basis/u);
    expect(() =>
      createHybridScore({
        featureVector: { ...featureVector(), schemaVersion: 0 as 1 },
        profileId: "bug-fix",
        profileVersion: 1,
        weights: {},
        basis: {},
      }),
    ).toThrow(/version/u);
  });
});
