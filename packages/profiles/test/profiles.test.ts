import { describe, expect, it } from "vitest";
import { BUILT_IN_PROFILES, getProfile } from "../src/index.js";
describe("profiles", () => {
  it("rejects unknown profiles", () =>
    expect(() => getProfile("unknown")).toThrow());
  it("applies overrides", () =>
    expect(getProfile("bug-fix", { git: 9 }).weights.git).toBe(9));
  it("owns security weights", () =>
    expect(getProfile("security-audit").weights.security).toBe(5));
  it("owns architecture weights", () =>
    expect(getProfile("architecture-review").weights.dependency).toBe(4));
  it("serializes versions", () =>
    expect(JSON.parse(JSON.stringify(BUILT_IN_PROFILES))[0].version).toBe(1));
  it("preserves built-in IDs and owns bounded expansion policies", () => {
    expect(BUILT_IN_PROFILES.map(({ id }) => id)).toEqual([
      "bug-fix",
      "feature-development",
      "code-review",
      "security-audit",
      "architecture-review",
      "documentation",
    ]);
    expect(
      BUILT_IN_PROFILES.every(
        ({ expansion }) =>
          expansion.maximumDepth > 0 &&
          expansion.maximumEdges >= expansion.maximumItems,
      ),
    ).toBe(true);
  });
  it("returns isolated compatible profile values", () => {
    const first = getProfile("bug-fix");
    const second = getProfile("bug-fix");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
