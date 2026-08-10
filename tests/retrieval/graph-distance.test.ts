import { describe, expect, it } from "vitest";
import { buildFilePackageGraph, createGraphEdge } from "@fuzit/graph";
import { scoreGraphDistance } from "@fuzit/selection";
import type { NormalizedAnalysis } from "@fuzit/schemas";

const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (value: number) => value.toString(16).padStart(64, "0");
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: ["a.ts", "b.ts", "c.ts"].map((path, index) => ({
    id: `analysis:file:${hash(index + 1)}`,
    repositoryId,
    kind: "file",
    path,
    language: "typescript",
    contentHash: `sha256:${hash(index + 10)}`,
  })),
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};
const base = buildFilePackageGraph({ analysis, revision: "r1", packages: [] });
const files = Object.fromEntries(
  base.nodes
    .filter((node) => node.kind === "file")
    .map((node) => [node.path!, node]),
);
const edge = (from: string, to: string, kind: "imports" | "depends-on") =>
  createGraphEdge({
    repositoryId,
    kind,
    sourceId: files[from]!.id,
    sourceKind: "file",
    targetId: files[to]!.id,
    targetKind: "file",
    unresolvedTarget: null,
    resolution: "resolved",
    evidence: [
      {
        basis: "parsed",
        collector: "fixture",
        collectorVersion: "1",
        sourcePath: from,
        reason: kind,
      },
    ],
    revision: { validFrom: "r1", validThrough: null },
  });

describe("graph-distance relevance", () => {
  it("chooses deterministic weighted shortest paths through cycles", () => {
    const graph = {
      ...base,
      edges: [
        ...base.edges,
        edge("a.ts", "b.ts", "imports"),
        edge("b.ts", "a.ts", "imports"),
        edge("a.ts", "c.ts", "depends-on"),
        edge("c.ts", "b.ts", "imports"),
      ],
    };
    const options = {
      requiredAnchorIds: [files["a.ts"]!.id],
      edgeWeights: { imports: 1, "depends-on": 0.5 },
      maxDepth: 3,
      maxNodes: 20,
      maxEdges: 50,
    };
    const first = scoreGraphDistance(graph, options);
    expect(scoreGraphDistance(graph, options)).toEqual(first);
    expect(
      first.find((score) => score.nodeId === files["b.ts"]!.id)?.graphPath,
    ).toEqual([files["a.ts"]!.id, files["b.ts"]!.id]);
  });
  it("records partial graph state and rejects unsafe bounds", () => {
    const graph = {
      ...base,
      completeness: "partial" as const,
      diagnostics: ["parser unavailable"],
    };
    expect(
      scoreGraphDistance(graph, {
        requiredAnchorIds: [base.nodes[0]!.id],
        edgeWeights: { contains: 1 },
        maxDepth: 1,
        maxNodes: 10,
        maxEdges: 10,
      })[0]?.basis,
    ).toContain("graph=partial");
    expect(() =>
      scoreGraphDistance(base, {
        requiredAnchorIds: [],
        edgeWeights: {},
        maxDepth: 11,
        maxNodes: 1,
        maxEdges: 1,
      }),
    ).toThrow(/depth/u);
  });
});
