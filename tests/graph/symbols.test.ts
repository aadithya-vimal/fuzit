import { describe, expect, it } from "vitest";
import { buildFilePackageGraph, materializeSymbolNodes } from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";

const repositoryId = `sha256:${"a".repeat(64)}`;
const fileId = `analysis:file:${"1".padStart(64, "0")}`;
const range = (start: number, end: number) => ({
  start: { offset: start, line: 1, column: start + 1 },
  end: { offset: end, line: 1, column: end + 1 },
});
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: [
    {
      id: fileId,
      repositoryId,
      kind: "file",
      path: "src/caf\u00e9.ts",
      language: "typescript",
      contentHash: `sha256:${"2".padStart(64, "0")}`,
    },
  ],
  modules: [],
  symbols: [
    {
      id: `analysis:symbol:${"3".padStart(64, "0")}`,
      repositoryId,
      kind: "method",
      name: "run",
      fileId,
      range: range(0, 3),
      exported: true,
    },
    {
      id: `analysis:symbol:${"4".padStart(64, "0")}`,
      repositoryId,
      kind: "method",
      name: "run",
      fileId,
      range: range(10, 13),
      exported: true,
    },
  ],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};

describe("symbol graph nodes", () => {
  it("materializes duplicate and overloaded names with stable attributable IDs", () => {
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
    const options = {
      parserIdentity: "typescript",
      parserVersion: "1",
      revision: "r1",
    };
    const first = materializeSymbolNodes(base, analysis, options);
    expect(materializeSymbolNodes(base, analysis, options)).toEqual(first);
    const symbols = first.nodes.filter((node) => node.kind === "symbol");
    expect(new Set(symbols.map((node) => node.id)).size).toBe(2);
    expect(
      symbols.every(
        (node) =>
          node.provenance.sourceRange !== null &&
          node.provenance.collector === "typescript",
      ),
    ).toBe(true);
  });
  it("reports a partial result when a symbol parent is unavailable", () => {
    const base = buildFilePackageGraph({
      analysis: { ...analysis, files: [] },
      revision: "r1",
      packages: [],
    });
    const result = materializeSymbolNodes(base, analysis, {
      parserIdentity: "typescript",
      parserVersion: "1",
      revision: "r1",
    });
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics[0]).toMatch(/^symbol parent unavailable:/u);
  });
});
