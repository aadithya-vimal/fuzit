import { describe, expect, it } from "vitest";
import {
  buildFilePackageGraph,
  materializeImportDependencyEdges,
} from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";

const repositoryId = `sha256:${"a".repeat(64)}`;
const id = (kind: string, value: string) =>
  `analysis:${kind}:${value.padStart(64, "0")}`;
const file = (path: string, value: string) => ({
  id: id("file", value),
  repositoryId,
  kind: "file" as const,
  path,
  language: "typescript",
  contentHash: `sha256:${value.padStart(64, "0")}`,
});
const provenance = {
  sourceFileId: id("file", "1"),
  sourceSymbolId: null,
  range: null,
  basis: "parsed" as const,
  parserIdentity: "typescript",
  analysisIdentity: "fixture",
  confidence: 1,
  resolution: "resolved" as const,
};

describe("import and dependency edges", () => {
  it("retains cycles, aliases, optional dependencies, and deleted targets", () => {
    const files = [file("a.ts", "1"), file("b.ts", "2")];
    const analysis: NormalizedAnalysis = {
      schemaVersion: 1,
      repositoryId,
      analysisIdentity: "fixture",
      files,
      modules: [],
      symbols: [],
      relationships: [
        {
          id: id("relation", "3"),
          repositoryId,
          kind: "import",
          sourceId: files[0]!.id,
          targetId: files[1]!.id,
          unresolvedTarget: null,
          provenance,
        },
        {
          id: id("relation", "4"),
          repositoryId,
          kind: "import",
          sourceId: files[1]!.id,
          targetId: files[0]!.id,
          unresolvedTarget: null,
          provenance: { ...provenance, sourceFileId: files[1]!.id },
        },
        {
          id: id("relation", "5"),
          repositoryId,
          kind: "import",
          sourceId: files[0]!.id,
          targetId: id("file", "9"),
          unresolvedTarget: "@alias/deleted",
          provenance: { ...provenance, resolution: "unresolved" },
        },
      ],
      completeness: "partial",
      diagnostics: [],
    };
    const base = buildFilePackageGraph({
      analysis,
      revision: "r1",
      packages: [
        {
          name: "a",
          path: ".",
          manifestPath: "package.json",
          dependencies: [{ name: "optional-missing", optional: true }],
        },
      ],
    });
    const graph = materializeImportDependencyEdges(base, analysis, {
      revision: "r1",
      collectorVersion: "1",
    });
    expect(graph.edges.filter((edge) => edge.kind === "imports")).toHaveLength(
      3,
    );
    expect(
      graph.edges.some((edge) => edge.unresolvedTarget === "@alias/deleted"),
    ).toBe(true);
    expect(
      graph.edges.some((edge) =>
        edge.evidence[0]?.reason.includes("optional manifest dependency"),
      ),
    ).toBe(true);
  });
});
