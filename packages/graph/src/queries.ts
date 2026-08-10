import type { GraphEdgeKind, GraphNode, GraphNodeKind } from "@fuzit/schemas";
import type { GraphSnapshot } from "./build.js";

export const GRAPH_QUERY_MAX_DEPTH = 10;
export const GRAPH_QUERY_MAX_ITEMS = 1_000;
export interface GraphQueryLimits {
  readonly depth: number;
  readonly maxItems: number;
}
export interface GraphQueryOptions {
  readonly repositoryId: string;
  readonly limits: GraphQueryLimits;
  readonly signal?: AbortSignal;
  readonly allowNode?: (node: GraphNode) => boolean;
  readonly nodeKinds?: readonly GraphNodeKind[];
  readonly edgeKinds?: readonly GraphEdgeKind[];
}
export interface GraphQueryResult {
  readonly nodes: readonly GraphNode[];
  readonly truncated: boolean;
  readonly diagnostics: readonly string[];
}
const byId = <T extends { readonly id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);
const validate = (snapshot: GraphSnapshot, options: GraphQueryOptions) => {
  if (options.repositoryId !== snapshot.repositoryId)
    throw new Error("Cross-repository graph queries are forbidden");
  if (
    !Number.isInteger(options.limits.depth) ||
    options.limits.depth < 0 ||
    options.limits.depth > GRAPH_QUERY_MAX_DEPTH
  )
    throw new Error(
      `Graph query depth must be between 0 and ${GRAPH_QUERY_MAX_DEPTH}`,
    );
  if (
    !Number.isInteger(options.limits.maxItems) ||
    options.limits.maxItems < 1 ||
    options.limits.maxItems > GRAPH_QUERY_MAX_ITEMS
  )
    throw new Error(
      `Graph query item limit must be between 1 and ${GRAPH_QUERY_MAX_ITEMS}`,
    );
};
const checkCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error("Graph query cancelled");
};

export function graphStats(snapshot: GraphSnapshot) {
  const count = (values: readonly string[]) =>
    Object.fromEntries(
      [...new Set(values)]
        .sort()
        .map((kind) => [kind, values.filter((item) => item === kind).length]),
    );
  return {
    schemaVersion: 1 as const,
    repositoryId: snapshot.repositoryId,
    nodes: snapshot.nodes.length,
    edges: snapshot.edges.length,
    nodeKinds: count(snapshot.nodes.map((node) => node.kind)),
    edgeKinds: count(snapshot.edges.map((edge) => edge.kind)),
    completeness: snapshot.completeness,
    diagnostics: [...snapshot.diagnostics].sort(),
  };
}

export function graphNeighbors(
  snapshot: GraphSnapshot,
  startId: string,
  options: GraphQueryOptions,
): GraphQueryResult {
  validate(snapshot, options);
  checkCancelled(options.signal);
  if (!snapshot.nodes.some((node) => node.id === startId))
    throw new Error("Graph query start node is unavailable");
  const allowedKinds = options.edgeKinds ? new Set(options.edgeKinds) : null;
  const allowedNodes = options.nodeKinds ? new Set(options.nodeKinds) : null;
  const visited = new Set([startId]);
  let frontier = [startId];
  let truncated = false;
  for (
    let depth = 0;
    depth < options.limits.depth && frontier.length;
    depth += 1
  ) {
    const next: string[] = [];
    for (const id of frontier.sort()) {
      checkCancelled(options.signal);
      for (const edge of snapshot.edges) {
        if (allowedKinds && !allowedKinds.has(edge.kind)) continue;
        const neighbor =
          edge.sourceId === id
            ? edge.targetId
            : edge.targetId === id
              ? edge.sourceId
              : null;
        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = [...new Set(next)].sort();
  }
  const nodes = snapshot.nodes
    .filter((node) => visited.has(node.id) && node.id !== startId)
    .filter(
      (node) =>
        (!allowedNodes || allowedNodes.has(node.kind)) &&
        (options.allowNode?.(node) ?? true),
    )
    .sort(byId);
  if (nodes.length > options.limits.maxItems) truncated = true;
  return {
    nodes: nodes.slice(0, options.limits.maxItems),
    truncated,
    diagnostics: truncated
      ? [`graph query truncated at ${options.limits.maxItems} items`]
      : [],
  };
}

export const graphImpact = graphNeighbors;
export function graphQuery(
  snapshot: GraphSnapshot,
  options: GraphQueryOptions,
): GraphQueryResult {
  validate(snapshot, options);
  checkCancelled(options.signal);
  const kinds = options.nodeKinds ? new Set(options.nodeKinds) : null;
  const nodes = snapshot.nodes
    .filter(
      (node) =>
        (!kinds || kinds.has(node.kind)) && (options.allowNode?.(node) ?? true),
    )
    .sort(byId);
  return {
    nodes: nodes.slice(0, options.limits.maxItems),
    truncated: nodes.length > options.limits.maxItems,
    diagnostics:
      nodes.length > options.limits.maxItems
        ? [`graph query truncated at ${options.limits.maxItems} items`]
        : [],
  };
}
