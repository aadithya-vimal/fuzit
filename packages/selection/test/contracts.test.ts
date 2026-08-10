import { describe, expect, it } from "vitest";
import { decideCandidates } from "../src/index.js";
const candidate = (path: string, value: number, mandatory = false) => ({
  id: path,
  path,
  mandatory,
  uncertainty: 0.2,
  contributions: [{ source: "test", value, reason: "evidence" }],
});
describe("selection contracts", () => {
  it("has deterministic score vectors", () =>
    expect(decideCandidates([candidate("a", 1)])).toEqual(
      decideCandidates([candidate("a", 1)]),
    ));
  it("breaks ties by path", () =>
    expect(
      decideCandidates([candidate("b", 1), candidate("a", 1)])[0]?.candidate
        .path,
    ).toBe("a"));
  it("reports excluded items", () =>
    expect(decideCandidates([candidate("a", 0)])[0]?.included).toBe(false));
  it("includes mandatory items", () =>
    expect(decideCandidates([candidate("a", -1, true)])[0]?.included).toBe(
      true,
    ));
  it("preserves uncertainty", () =>
    expect(
      decideCandidates([candidate("a", 1)])[0]?.candidate.uncertainty,
    ).toBe(0.2));
  it("supports versioned profiles", () =>
    expect({ id: "bug-fix", version: 1, weights: {} }).toMatchObject({
      version: 1,
    }));
});
