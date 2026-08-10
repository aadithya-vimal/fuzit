import type { GraphEdgeKind, GraphSnapshot } from "@fuzit/graph";

export interface GraphDistanceOptions {
  readonly requiredAnchorIds: readonly string[];
  readonly initialMatchIds?: readonly string[];
  readonly edgeWeights: Readonly<Partial<Record<GraphEdgeKind, number>>>;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxEdges: number;
  readonly signal?: AbortSignal;
}

export interface GraphDistanceScore {
  readonly nodeId: string;
  readonly value: number;
  readonly basis: string;
  readonly distance: number;
  readonly graphPath: readonly string[];
  readonly edgeTypes: readonly GraphEdgeKind[];
}

interface PathState {
  readonly nodeId: string;
  readonly path: readonly string[];
  readonly edgeTypes: readonly GraphEdgeKind[];
  readonly weight: number;
}

const pathKey = (state: PathState) =>
  `${state.path.join("\0")}\0${state.edgeTypes.join("\0")}`;

export function scoreGraphDistance(
  graph: GraphSnapshot,
  options: GraphDistanceOptions,
): readonly GraphDistanceScore[] {
  if (
    !Number.isInteger(options.maxDepth) ||
    options.maxDepth < 0 ||
    options.maxDepth > 10
  ) {
    throw new Error("Graph distance depth must be between 0 and 10");
  }
  if (
    !Number.isInteger(options.maxNodes) ||
    options.maxNodes < 1 ||
    options.maxNodes > 1_000
  ) {
    throw new Error("Graph distance node limit must be between 1 and 1000");
  }
  if (
    !Number.isInteger(options.maxEdges) ||
    options.maxEdges < 1 ||
    options.maxEdges > 10_000
  ) {
    throw new Error("Graph distance edge limit must be between 1 and 10000");
  }
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const anchors = [
    ...new Set([
      ...options.requiredAnchorIds,
      ...(options.initialMatchIds ?? []),
    ]),
  ]
    .filter((id) => nodeIds.has(id))
    .sort();
  const visited = new Map<string, PathState>();
  let frontier: PathState[] = anchors.map((nodeId) => ({
    nodeId,
    path: [nodeId],
    edgeTypes: [],
    weight: 1,
  }));
  let inspectedEdges = 0;
  for (
    let depth = 0;
    depth < options.maxDepth && frontier.length > 0;
    depth += 1
  ) {
    const next: PathState[] = [];
    for (const current of frontier.sort((a, b) =>
      pathKey(a).localeCompare(pathKey(b)),
    )) {
      if (options.signal?.aborted)
        throw new Error("Graph distance scoring cancelled");
      for (const edge of graph.edges) {
        if (edge.resolution !== "resolved") continue;
        const target =
          edge.sourceId === current.nodeId
            ? edge.targetId
            : edge.targetId === current.nodeId
              ? edge.sourceId
              : null;
        if (!target || current.path.includes(target)) continue;
        inspectedEdges += 1;
        if (inspectedEdges > options.maxEdges)
          return serializeScores(visited, graph.completeness, true);
        const edgeWeight = options.edgeWeights[edge.kind] ?? 0;
        if (edgeWeight <= 0) continue;
        const candidate: PathState = {
          nodeId: target,
          path: [...current.path, target],
          edgeTypes: [...current.edgeTypes, edge.kind],
          weight: current.weight * edgeWeight,
        };
        const previous = visited.get(target);
        if (
          !previous ||
          candidate.path.length < previous.path.length ||
          (candidate.path.length === previous.path.length &&
            pathKey(candidate).localeCompare(pathKey(previous)) < 0)
        ) {
          visited.set(target, candidate);
          next.push(candidate);
          if (visited.size >= options.maxNodes)
            return serializeScores(visited, graph.completeness, true);
        }
      }
    }
    frontier = next;
  }
  for (const anchor of anchors) visited.delete(anchor);
  return serializeScores(visited, graph.completeness, false);
}

function serializeScores(
  states: ReadonlyMap<string, PathState>,
  completeness: GraphSnapshot["completeness"],
  truncated: boolean,
): readonly GraphDistanceScore[] {
  return [...states.values()]
    .map((state) => ({
      nodeId: state.nodeId,
      value: state.weight / Math.max(1, state.path.length - 1),
      basis: `graph distance ${state.path.length - 1}; edges=${state.edgeTypes.join(",") || "none"}; graph=${completeness}${truncated ? "; bounded" : ""}`,
      distance: state.path.length - 1,
      graphPath: state.path,
      edgeTypes: state.edgeTypes,
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.distance - b.distance ||
        a.nodeId.localeCompare(b.nodeId),
    );
}
