import type { GraphEdgeKind, NormalizedAnalysis } from "@fuzit/schemas";
import { createGraphEdge } from "./edges.js";
import type { GraphSnapshot } from "./build.js";

export interface MaterializeDependencyOptions {
  readonly revision: string;
  readonly collectorVersion: string;
}
const edgeKind = (kind: string): GraphEdgeKind | null =>
  kind === "import"
    ? "imports"
    : kind === "export"
      ? "exports"
      : kind === "reference"
        ? "references"
        : kind === "call"
          ? "calls"
          : null;

export function materializeImportDependencyEdges(
  snapshot: GraphSnapshot,
  analysis: NormalizedAnalysis,
  options: MaterializeDependencyOptions,
): GraphSnapshot {
  if (snapshot.repositoryId !== analysis.repositoryId)
    throw new Error("Graph and analysis repository identities must match");
  const fileByAnalysisId = new Map(
    analysis.files.map((file) => [
      file.id,
      snapshot.nodes.find(
        (node) => node.kind === "file" && node.path === file.path,
      ),
    ]),
  );
  const symbolByAnalysisId = new Map(
    analysis.symbols.map((symbol) => {
      const file = analysis.files.find((item) => item.id === symbol.fileId);
      const node = snapshot.nodes.find(
        (item) =>
          item.path === file?.path &&
          item.provenance.sourceRange?.start.offset ===
            symbol.range.start.offset &&
          ["symbol", "test", "endpoint", "schema-model"].includes(item.kind),
      );
      return [symbol.id, node] as const;
    }),
  );
  const resolve = (id: string) =>
    fileByAnalysisId.get(id) ?? symbolByAnalysisId.get(id);
  const edges = [...snapshot.edges];
  const diagnostics = [...snapshot.diagnostics];
  for (const relation of [...analysis.relationships].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const kind = edgeKind(relation.kind);
    if (!kind) continue;
    const source = resolve(relation.sourceId);
    const target = relation.targetId ? resolve(relation.targetId) : undefined;
    if (!source) {
      diagnostics.push(`dependency source unavailable: ${relation.id}`);
      continue;
    }
    const unresolvedTarget = target
      ? null
      : (relation.unresolvedTarget ?? relation.targetId ?? "deleted-target");
    edges.push(
      createGraphEdge({
        repositoryId: snapshot.repositoryId,
        kind,
        sourceId: source.id,
        sourceKind: source.kind,
        targetId: target?.id ?? null,
        targetKind: target?.kind ?? null,
        unresolvedTarget,
        resolution: target ? "resolved" : "unresolved",
        evidence: [
          {
            basis: "parsed",
            collector: relation.provenance.parserIdentity,
            collectorVersion: options.collectorVersion,
            sourcePath: source.path,
            reason: target
              ? `${relation.kind} resolved`
              : `${relation.kind} unresolved: ${unresolvedTarget}`,
          },
        ],
        revision: { validFrom: options.revision, validThrough: null },
      }),
    );
  }
  return {
    ...snapshot,
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: diagnostics.sort(),
    completeness: diagnostics.length ? "partial" : snapshot.completeness,
  };
}
