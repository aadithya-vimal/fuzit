import type {
  GraphEdgeKind,
  GraphNode,
  NormalizedAnalysis,
} from "@fuzit/schemas";
import type { GraphSnapshot } from "./build.js";
import { createGraphEdge } from "./edges.js";
import { createGraphNode } from "./nodes.js";

export interface MaterializeDomainRelationOptions {
  readonly revision: string;
  readonly collectorVersion: string;
}
const specializedKinds = new Set(["test", "endpoint", "schema-model"]);
const findNode = (
  snapshot: GraphSnapshot,
  analysis: NormalizedAnalysis,
  id: string,
): GraphNode | undefined => {
  const file = analysis.files.find((item) => item.id === id);
  if (file)
    return snapshot.nodes.find(
      (node) => node.kind === "file" && node.path === file.path,
    );
  const symbol = analysis.symbols.find((item) => item.id === id);
  const symbolFile =
    symbol && analysis.files.find((item) => item.id === symbol.fileId);
  return symbol && symbolFile
    ? snapshot.nodes.find(
        (node) =>
          node.path === symbolFile.path &&
          node.provenance.sourceRange?.start.offset ===
            symbol.range.start.offset &&
          (node.kind === "symbol" || specializedKinds.has(node.kind)),
      )
    : undefined;
};

export function materializeDomainRelations(
  snapshot: GraphSnapshot,
  analysis: NormalizedAnalysis,
  options: MaterializeDomainRelationOptions,
): GraphSnapshot {
  if (snapshot.repositoryId !== analysis.repositoryId)
    throw new Error("Graph and analysis repository identities must match");
  const nodes = [...snapshot.nodes];
  const edges = [...snapshot.edges];
  const diagnostics = [...snapshot.diagnostics];
  for (const relation of [...analysis.relationships].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (
      !["test", "endpoint", "schema", "configuration-link"].includes(
        relation.kind,
      )
    )
      continue;
    let source = findNode({ ...snapshot, nodes }, analysis, relation.sourceId);
    const target = relation.targetId
      ? findNode({ ...snapshot, nodes }, analysis, relation.targetId)
      : undefined;
    const kind: GraphEdgeKind =
      relation.kind === "test"
        ? "tests"
        : relation.kind === "configuration-link"
          ? "configures"
          : "references";
    if (relation.kind === "configuration-link") {
      const sourceFile = analysis.files.find(
        (file) => file.id === relation.provenance.sourceFileId,
      );
      const parent =
        sourceFile &&
        nodes.find(
          (node) => node.kind === "file" && node.path === sourceFile.path,
        );
      if (sourceFile && parent) {
        source = createGraphNode({
          repositoryId: snapshot.repositoryId,
          kind: "configuration",
          identity: `${sourceFile.path}\0${relation.id}`,
          path: sourceFile.path,
          parentId: parent.id,
          provenance: {
            collector: relation.provenance.parserIdentity,
            collectorVersion: options.collectorVersion,
            basis: relation.provenance.basis,
            revision: options.revision,
            sourcePath: sourceFile.path,
            sourceRange: relation.provenance.range,
          },
        });
        nodes.push(source);
      }
    }
    if (!source) {
      diagnostics.push(`domain relation source unavailable: ${relation.id}`);
      continue;
    }
    const unresolvedTarget = target
      ? null
      : (relation.unresolvedTarget ??
        relation.targetId ??
        `${relation.kind}-target`);
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
            basis:
              relation.provenance.basis === "parsed" ? "parsed" : "heuristic",
            collector: relation.provenance.parserIdentity,
            collectorVersion: options.collectorVersion,
            sourcePath: source.path,
            reason: `${relation.kind} evidence`,
          },
        ],
        revision: { validFrom: options.revision, validThrough: null },
      }),
    );
  }
  return {
    ...snapshot,
    nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: diagnostics.sort(),
    completeness: diagnostics.length ? "partial" : snapshot.completeness,
  };
}
