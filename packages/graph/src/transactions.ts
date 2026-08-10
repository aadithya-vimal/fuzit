import type { GraphEdge, GraphNode } from "@fuzit/schemas";
import type { GraphSnapshot } from "./build.js";

export interface GraphTombstone {
  readonly id: string;
  readonly kind: "node" | "edge";
  readonly revision: string;
  readonly reason: "deleted" | "replaced" | "incident";
}
export interface GraphTransactionState extends GraphSnapshot {
  readonly tombstones: readonly GraphTombstone[];
}
export interface GraphTransaction {
  readonly revision: string;
  readonly replaceNodes?: readonly GraphNode[];
  readonly replaceEdges?: readonly GraphEdge[];
  readonly deleteNodeIds?: readonly string[];
  readonly deleteEdgeIds?: readonly string[];
  readonly beforeCommit?: () => void;
}
const byId = <T extends { readonly id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);
export function withGraphTransactions(
  snapshot: GraphSnapshot,
): GraphTransactionState {
  return { ...snapshot, tombstones: [] };
}
export function applyGraphTransaction(
  current: GraphTransactionState,
  transaction: GraphTransaction,
): GraphTransactionState {
  const deleteNodes = new Set(transaction.deleteNodeIds ?? []);
  const deleteEdges = new Set(transaction.deleteEdgeIds ?? []);
  for (const edge of current.edges)
    if (
      deleteNodes.has(edge.sourceId) ||
      (edge.targetId && deleteNodes.has(edge.targetId))
    )
      deleteEdges.add(edge.id);
  const replacementNodes = new Map(
    (transaction.replaceNodes ?? []).map((node) => [node.id, node]),
  );
  const replacementEdges = new Map(
    (transaction.replaceEdges ?? []).map((edge) => [edge.id, edge]),
  );
  const tombstones = [...current.tombstones];
  for (const id of [...deleteNodes].sort())
    tombstones.push({
      id,
      kind: "node",
      revision: transaction.revision,
      reason: replacementNodes.has(id) ? "replaced" : "deleted",
    });
  for (const id of [...deleteEdges].sort())
    tombstones.push({
      id,
      kind: "edge",
      revision: transaction.revision,
      reason: "incident",
    });
  const nodes = current.nodes.filter(
    (node) => !deleteNodes.has(node.id) && !replacementNodes.has(node.id),
  );
  const edges = current.edges.filter(
    (edge) => !deleteEdges.has(edge.id) && !replacementEdges.has(edge.id),
  );
  nodes.push(...replacementNodes.values());
  edges.push(...replacementEdges.values());
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (
    edges.some(
      (edge) =>
        !nodeIds.has(edge.sourceId) ||
        (edge.targetId !== null && !nodeIds.has(edge.targetId)),
    )
  )
    throw new Error("Graph transaction would create a dangling edge");
  transaction.beforeCommit?.();
  return {
    ...current,
    nodes: nodes.sort(byId),
    edges: edges.sort(byId),
    tombstones: tombstones.sort(
      (a, b) =>
        a.id.localeCompare(b.id) || a.revision.localeCompare(b.revision),
    ),
  };
}
