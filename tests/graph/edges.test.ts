import { describe, expect, it } from "vitest";
import { createGraphEdge, createGraphEdgeId } from "@fuzit/graph";

const repositoryId = `sha256:${"a".repeat(64)}`;
const sourceId = `graph:node:${"b".repeat(64)}`;
const targetId = `graph:node:${"c".repeat(64)}`;
const evidence = (basis: "direct" | "parsed" | "heuristic") => ({
  basis,
  collector: "fixture",
  collectorVersion: "1",
  sourcePath: "src/a.ts",
  reason: `${basis} fixture evidence`,
});
const resolved = (basis: "direct" | "parsed" | "heuristic") => ({
  repositoryId,
  kind: "imports" as const,
  sourceId,
  sourceKind: "file" as const,
  targetId,
  targetKind: "file" as const,
  unresolvedTarget: null,
  resolution: "resolved" as const,
  evidence: [evidence(basis)],
  revision: { validFrom: "r1", validThrough: null },
});

describe("graph edge contracts", () => {
  it.each(["direct", "parsed", "heuristic"] as const)(
    "retains %s evidence",
    (basis) => {
      expect(createGraphEdge(resolved(basis)).evidence[0]?.basis).toBe(basis);
    },
  );

  it("keeps unresolved and conflicting evidence explicit", () => {
    const unresolved = createGraphEdge({
      ...resolved("parsed"),
      targetId: null,
      targetKind: null,
      unresolvedTarget: "@missing/package",
      resolution: "unresolved",
    });
    const conflicting = createGraphEdge({
      ...resolved("direct"),
      kind: "depends-on",
      sourceKind: "package",
      targetKind: "package",
      resolution: "conflicting",
      evidence: [evidence("direct"), evidence("heuristic")],
    });
    expect(unresolved.unresolvedTarget).toBe("@missing/package");
    expect(conflicting.evidence).toHaveLength(2);
  });

  it("rejects invalid directions and keeps stable IDs", () => {
    expect(createGraphEdgeId(repositoryId, "imports", sourceId, targetId)).toBe(
      createGraphEdgeId(repositoryId, "imports", sourceId, targetId),
    );
    expect(() =>
      createGraphEdge({
        ...resolved("direct"),
        kind: "contains",
        sourceKind: "file",
        targetKind: "repository",
      }),
    ).toThrow(/Invalid contains edge direction/u);
  });
});
