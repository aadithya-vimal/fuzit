import { describe, expect, it } from "vitest";
import {
  buildFilePackageGraph,
  materializeDomainRelations,
  materializeSymbolNodes,
} from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";

const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (n: number) => n.toString(16).padStart(64, "0");
const fileId = `analysis:file:${hash(1)}`;
const targetId = `analysis:file:${hash(2)}`;
const symbolId = `analysis:symbol:${hash(5)}`;
const range = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 3, line: 1, column: 4 },
};
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: [
    {
      id: fileId,
      repositoryId,
      kind: "file",
      path: "tests/api.test.ts",
      language: "typescript",
      contentHash: `sha256:${hash(3)}`,
    },
    {
      id: targetId,
      repositoryId,
      kind: "file",
      path: "src/api.ts",
      language: "typescript",
      contentHash: `sha256:${hash(4)}`,
    },
    {
      id: `analysis:file:${hash(9)}`,
      repositoryId,
      kind: "file",
      path: "src/controller-looking.ts",
      language: "typescript",
      contentHash: `sha256:${hash(9)}`,
    },
  ],
  modules: [],
  symbols: [
    {
      id: symbolId,
      repositoryId,
      kind: "test",
      name: "works",
      fileId,
      range,
      exported: false,
    },
  ],
  relationships: [
    {
      id: `analysis:relation:${hash(6)}`,
      repositoryId,
      kind: "test",
      sourceId: symbolId,
      targetId,
      unresolvedTarget: null,
      provenance: {
        sourceFileId: fileId,
        sourceSymbolId: symbolId,
        range,
        basis: "parsed",
        parserIdentity: "typescript",
        analysisIdentity: "fixture",
        confidence: 1,
        resolution: "resolved",
      },
    },
  ],
  completeness: "complete",
  diagnostics: [],
};

describe("domain graph relations", () => {
  it("adds justified relations without lookalike false positives", () => {
    const base = buildFilePackageGraph({
      analysis,
      revision: "r1",
      packages: [
        {
          name: "root",
          path: ".",
          manifestPath: "package.json",
          dependencies: [],
        },
      ],
    });
    const symbols = materializeSymbolNodes(base, analysis, {
      parserIdentity: "typescript",
      parserVersion: "1",
      revision: "r1",
    });
    const graph = materializeDomainRelations(symbols, analysis, {
      revision: "r1",
      collectorVersion: "1",
    });
    expect(graph.edges.filter((edge) => edge.kind === "tests")).toHaveLength(1);
    expect(
      graph.edges
        .filter((edge) =>
          ["tests", "configures", "references"].includes(edge.kind),
        )
        .some(
          (edge) =>
            edge.evidence[0]?.sourcePath === "src/controller-looking.ts",
        ),
    ).toBe(false);
  });
  it("keeps missing relation sources partial", () => {
    const empty = { ...analysis, symbols: [], relationships: [] };
    const base = buildFilePackageGraph({
      analysis: empty,
      revision: "r1",
      packages: [],
    });
    const result = materializeDomainRelations(
      base,
      {
        ...analysis,
        relationships: [
          {
            ...analysis.relationships[0]!,
            sourceId: `analysis:symbol:${hash(8)}`,
          },
        ],
      },
      { revision: "r1", collectorVersion: "1" },
    );
    expect(result.completeness).toBe("partial");
  });
});
