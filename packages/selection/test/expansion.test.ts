import { describe, expect, it } from "vitest";
import { expandDependencies, type ExpansionEdge } from "../src/index.js";
const edge = (
  from: string,
  to: string,
  resolved = true,
  relationship: "dependency" | "reverse-dependency" | "test" = "dependency",
): ExpansionEdge => ({ from, to, resolved, relationship });
describe("dependency expansion", () => {
  it("handles cycles", () =>
    expect(
      expandDependencies(["a"], [edge("a", "b"), edge("b", "a")], {
        depth: 3,
        decay: 0.5,
        cap: 10,
      }).map((x) => x.path),
    ).toEqual(["a", "b"]));
  it("caps high-degree nodes", () =>
    expect(
      expandDependencies(["a"], [edge("a", "b"), edge("a", "c")], {
        depth: 1,
        decay: 0.5,
        cap: 2,
      }),
    ).toHaveLength(2));
  it("skips unresolved edges", () =>
    expect(
      expandDependencies(["a"], [edge("a", "b", false)], {
        depth: 1,
        decay: 0.5,
        cap: 10,
      }),
    ).toHaveLength(1));
  it("honors depth zero", () =>
    expect(
      expandDependencies(["a"], [edge("a", "b")], {
        depth: 0,
        decay: 0.5,
        cap: 10,
      }),
    ).toHaveLength(1));
  it("deduplicates paths", () =>
    expect(
      expandDependencies(["a", "a"], [], { depth: 1, decay: 0.5, cap: 10 }),
    ).toHaveLength(1));
  it("preserves test relationships", () =>
    expect(
      expandDependencies(["a"], [edge("a", "a.test", true, "test")], {
        depth: 1,
        decay: 0.5,
        cap: 10,
      })[1]?.relationshipPath[1],
    ).toBe("test:a.test"));
  it("bounds expansion storms by edges and items", () => {
    const result = expandDependencies(
      ["a"],
      Array.from({ length: 100 }, (_, index) => edge("a", `node-${index}`)),
      { depth: 2, decay: 0.5, cap: 4, maximumEdges: 3 },
    );
    expect(result).toHaveLength(4);
    expect(result.every((item) => item.bounds.maximumEdges === 3)).toBe(true);
  });
  it("preserves required anchors even when the item cap is smaller", () => {
    const result = expandDependencies([], [], {
      depth: 0,
      decay: 0.5,
      cap: 1,
      requiredAnchors: ["b", "a"],
      tokenBudget: 0,
    });
    expect(result.map(({ path, reason }) => [path, reason])).toEqual([
      ["a", "required-anchor"],
      ["b", "required-anchor"],
    ]);
  });
  it("enforces confidence, relationship, security, budget, and cancellation bounds", () => {
    const controller = new AbortController();
    expect(
      expandDependencies(["a"], [edge("a", "b")], {
        depth: 1,
        decay: 0.5,
        cap: 10,
        signal: AbortSignal.abort(),
      }),
    ).toEqual([]);
    const result = expandDependencies(
      ["a"],
      [
        { ...edge("a", "low"), confidence: 0.1 },
        edge("a", "test", true, "test"),
        edge("a", "safe"),
      ],
      {
        depth: 1,
        decay: 0.5,
        cap: 10,
        minimumConfidence: 0.5,
        allowedRelationships: ["dependency"],
        securityAllowedPaths: ["a", "safe"],
        tokenBudget: 2,
        signal: controller.signal,
      },
    );
    expect(result.map(({ path }) => path)).toEqual(["a", "safe"]);
  });
});
