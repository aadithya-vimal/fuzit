import { describe, expect, it } from "vitest";
import { buildFilePackageGraph, createGraphEdge } from "@fuzit/graph";
import { scoreRelatedTests } from "@fuzit/selection";
import type { NormalizedAnalysis } from "@fuzit/schemas";
const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (n: number) => n.toString(16).padStart(64, "0");
const paths = [
  "src/api.ts",
  "tests/api.test.ts",
  "integration/api.integration.ts",
  "e2e/api.e2e.ts",
  "src/contest.ts",
  "tests/unrelated.test.ts",
];
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: paths.map((path, index) => ({
    id: `analysis:file:${hash(index + 1)}`,
    repositoryId,
    kind: "file",
    path,
    language: "typescript",
    contentHash: `sha256:${hash(index + 20)}`,
  })),
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};
const base = buildFilePackageGraph({
  analysis,
  revision: "r1",
  packages: [
    { name: "root", path: ".", manifestPath: "package.json", dependencies: [] },
  ],
});
const node = (path: string) => base.nodes.find((item) => item.path === path)!;

describe("related-test relevance", () => {
  it("prioritizes explicit and parsed evidence with test distinctions", () => {
    const explicit = createGraphEdge({
      repositoryId,
      kind: "tests",
      sourceId: node("tests/api.test.ts").id,
      sourceKind: "test",
      targetId: node("src/api.ts").id,
      targetKind: "file",
      unresolvedTarget: null,
      resolution: "resolved",
      evidence: [
        {
          basis: "parsed",
          collector: "fixture",
          collectorVersion: "1",
          sourcePath: "tests/api.test.ts",
          reason: "explicit",
        },
      ],
      revision: { validFrom: "r1", validThrough: null },
    });
    const graph = {
      ...base,
      nodes: base.nodes.map((item) =>
        item.path === "tests/api.test.ts"
          ? { ...item, kind: "test" as const }
          : item,
      ),
      edges: [...base.edges, explicit],
    };
    const results = scoreRelatedTests(graph, [node("src/api.ts").id]);
    expect(results[0]).toMatchObject({ value: 1, testKind: "unit" });
    expect(results.some((item) => item.testKind === "integration")).toBe(true);
    expect(results.some((item) => item.testKind === "e2e")).toBe(true);
  });
  it("excludes false-positive and unrelated test filenames", () => {
    const results = scoreRelatedTests(base, [node("src/api.ts").id]);
    expect(
      results.some((item) => item.nodeId === node("src/contest.ts").id),
    ).toBe(false);
    expect(
      results.some(
        (item) =>
          item.nodeId === node("tests/unrelated.test.ts").id &&
          item.value >= 0.6,
      ),
    ).toBe(false);
  });
  it("bounds result expansion", () => {
    expect(() => scoreRelatedTests(base, [], 201)).toThrow(/limit/u);
  });
});
