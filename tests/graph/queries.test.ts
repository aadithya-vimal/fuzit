import { describe, expect, it } from "vitest";
import {
  GRAPH_QUERY_MAX_ITEMS,
  buildFilePackageGraph,
  graphNeighbors,
  graphQuery,
  graphStats,
} from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";
const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (n: number) => n.toString(16).padStart(64, "0");
const analysis = (count: number): NormalizedAnalysis => ({
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: Array.from({ length: count }, (_, i) => ({
    id: `analysis:file:${hash(i + 1)}`,
    repositoryId,
    kind: "file",
    path: `src/${i}.ts`,
    language: "typescript",
    contentHash: `sha256:${hash(i + 2000)}`,
  })),
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
});

describe("bounded graph queries", () => {
  it("returns reproducible stats and policy-filtered nodes", () => {
    const graph = buildFilePackageGraph({
      analysis: analysis(3),
      revision: "r1",
      packages: [],
    });
    expect(graphStats(graph)).toEqual(graphStats(graph));
    const result = graphQuery(graph, {
      repositoryId,
      limits: { depth: 1, maxItems: 10 },
      nodeKinds: ["file"],
      allowNode: (node) => node.path !== "src/1.ts",
    });
    expect(result.nodes.map((node) => node.path)).toEqual([
      "src/0.ts",
      "src/2.ts",
    ]);
  });
  it("rejects unbounded and cross-root queries", () => {
    const graph = buildFilePackageGraph({
      analysis: analysis(1),
      revision: "r1",
      packages: [],
    });
    expect(() =>
      graphQuery(graph, { repositoryId, limits: { depth: 11, maxItems: 1 } }),
    ).toThrow(/depth/u);
    expect(() =>
      graphQuery(graph, {
        repositoryId: `sha256:${"b".repeat(64)}`,
        limits: { depth: 1, maxItems: 1 },
      }),
    ).toThrow(/Cross-repository/u);
  });
  it("bounds graph bombs and cycles and supports cancellation", () => {
    const graph = buildFilePackageGraph({
      analysis: analysis(GRAPH_QUERY_MAX_ITEMS + 1),
      revision: "r1",
      packages: [],
    });
    expect(
      graphQuery(graph, {
        repositoryId,
        limits: { depth: 1, maxItems: GRAPH_QUERY_MAX_ITEMS },
      }).truncated,
    ).toBe(true);
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      graphNeighbors(graph, graph.nodes[0]!.id, {
        repositoryId,
        limits: { depth: 10, maxItems: 10 },
        signal: controller.signal,
      }),
    ).toThrow(/cancelled/u);
  });
});
