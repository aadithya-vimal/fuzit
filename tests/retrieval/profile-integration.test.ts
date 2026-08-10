import { getProfile } from "@fuzit/profiles";
import { createHybridScore, type HybridFeatureVector } from "@fuzit/selection";
import { describe, expect, it } from "vitest";

const vector: HybridFeatureVector = {
  schemaVersion: 1,
  candidateId: "candidate:src/change.ts",
  path: "src/change.ts",
  requiredAnchor: false,
  features: { dependency: 0.8, doc: 0.8, exact: 0.5 },
};

const rank = (profileId: string) => {
  const profile = getProfile(profileId);
  return createHybridScore({
    featureVector: vector,
    profileId: profile.id,
    profileVersion: profile.version,
    weights: profile.weights,
    basis: {
      dependency: "resolved graph edge",
      doc: "documentation relation",
      exact: "exact identifier",
    },
  });
};

describe("profile-integrated hybrid ranking", () => {
  it("produces same-task differences for recorded profile weights", () => {
    const architecture = rank("architecture-review");
    const documentation = rank("documentation");
    expect(architecture.aggregateScore).not.toBe(documentation.aggregateScore);
    expect(
      architecture.components.find(
        ({ component }) => component === "dependency",
      )?.weight,
    ).toBe(4);
    expect(
      documentation.components.find(({ component }) => component === "doc")
        ?.weight,
    ).toBe(5);
  });
  it("is deterministic for the same task and profile", () => {
    expect(rank("bug-fix")).toEqual(rank("bug-fix"));
  });
  it("rejects an unknown profile before ranking", () => {
    expect(() => rank("unknown")).toThrow("Unknown profile: unknown");
  });
});
