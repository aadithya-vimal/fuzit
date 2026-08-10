import type { GraphNodeKind, NormalizedAnalysis } from "@fuzit/schemas";
import { createGraphEdge } from "./edges.js";
import { createGraphNode } from "./nodes.js";
import type { GraphSnapshot } from "./build.js";

export interface MaterializeSymbolOptions {
  readonly parserIdentity: string;
  readonly parserVersion: string;
  readonly revision: string;
}
const byId = <T extends { readonly id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);
const nodeKind = (kind: string): GraphNodeKind =>
  kind === "test"
    ? "test"
    : kind === "endpoint"
      ? "endpoint"
      : kind === "schema"
        ? "schema-model"
        : "symbol";

export function materializeSymbolNodes(
  snapshot: GraphSnapshot,
  analysis: NormalizedAnalysis,
  options: MaterializeSymbolOptions,
): GraphSnapshot {
  if (snapshot.repositoryId !== analysis.repositoryId)
    throw new Error("Graph and analysis repository identities must match");
  const analysisFiles = new Map(analysis.files.map((file) => [file.id, file]));
  const graphFiles = new Map(
    snapshot.nodes
      .filter((node) => node.kind === "file" && node.path)
      .map((node) => [node.path!, node]),
  );
  const diagnostics = [...snapshot.diagnostics];
  const nodes = [...snapshot.nodes];
  const edges = [...snapshot.edges];
  for (const symbol of [...analysis.symbols].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const file = analysisFiles.get(symbol.fileId);
    const parent = file ? graphFiles.get(file.path) : undefined;
    if (!file || !parent) {
      diagnostics.push(`symbol parent unavailable: ${symbol.id}`);
      continue;
    }
    const identity = `${file.path}\0${symbol.kind}\0${symbol.name}\0${symbol.range.start.offset}\0${symbol.range.end.offset}`;
    const node = createGraphNode({
      repositoryId: snapshot.repositoryId,
      kind: nodeKind(symbol.kind),
      identity,
      path: file.path,
      parentId: parent.id,
      provenance: {
        collector: options.parserIdentity,
        collectorVersion: options.parserVersion,
        basis: "parsed",
        revision: options.revision,
        sourcePath: file.path,
        sourceRange: symbol.range,
      },
    });
    nodes.push(node);
    edges.push(
      createGraphEdge({
        repositoryId: snapshot.repositoryId,
        kind: "contains",
        sourceId: parent.id,
        sourceKind: "file",
        targetId: node.id,
        targetKind: node.kind,
        unresolvedTarget: null,
        resolution: "resolved",
        evidence: [
          {
            basis: "parsed",
            collector: options.parserIdentity,
            collectorVersion: options.parserVersion,
            sourcePath: file.path,
            reason: `parsed ${symbol.kind} ${symbol.name}`,
          },
        ],
        revision: { validFrom: options.revision, validThrough: null },
      }),
    );
  }
  return {
    ...snapshot,
    nodes: nodes.sort(byId),
    edges: edges.sort(byId),
    diagnostics: diagnostics.sort(),
    completeness: diagnostics.length ? "partial" : snapshot.completeness,
  };
}
