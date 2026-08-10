import { graphNeighbors, graphImpact, type GraphSnapshot } from "@fuzit/graph";

import { MAX_GRAPH_DEPTH, MAX_GRAPH_NODES } from "../config.js";
import { type McpCallContext, runTool, validateRoot } from "../tool-runner.js";

/**
 * fuzit_graph_neighbors — returns bounded graph neighborhood of a file.
 * Respects depth, node, and edge limits. Cancellation-aware.
 */
export async function fuzitGraphNeighbors(
  args: {
    root: unknown;
    path: unknown;
    depth?: unknown;
    edgeKinds?: unknown;
  },
  context: McpCallContext,
  getSnapshot: (root: string) => GraphSnapshot | null,
): Promise<ReturnType<typeof runTool>> {
  return runTool(async () => {
    const validRoot = await validateRoot(args.root, context);
    if (typeof args.path !== "string" || args.path.trim().length === 0)
      throw new TypeError("path must be a non-empty string");

    const depth =
      typeof args.depth === "number" && Number.isInteger(args.depth)
        ? Math.min(Math.max(0, args.depth), MAX_GRAPH_DEPTH)
        : 2;

    const snapshot = getSnapshot(validRoot);
    if (!snapshot)
      return {
        schemaVersion: 1,
        nodes: [],
        truncated: false,
        diagnostics: ["no-graph"],
      };

    const result = graphNeighbors(snapshot, args.path, {
      repositoryId: snapshot.repositoryId,
      limits: { depth, maxItems: MAX_GRAPH_NODES },
    });

    return {
      schemaVersion: 1,
      root: validRoot,
      startPath: args.path,
      nodes: result.nodes.map((n) => ({ id: n.id, kind: n.kind })),
      truncated: result.truncated,
      diagnostics: result.diagnostics,
    };
  });
}

/**
 * fuzit_graph_impact — returns bounded impact set from a changed file.
 * Rejects unbounded requests and preserves policy filtering.
 */
export async function fuzitGraphImpact(
  args: {
    root: unknown;
    path: unknown;
    depth?: unknown;
  },
  context: McpCallContext,
  getSnapshot: (root: string) => GraphSnapshot | null,
): Promise<ReturnType<typeof runTool>> {
  return runTool(async () => {
    const validRoot = await validateRoot(args.root, context);
    if (typeof args.path !== "string" || args.path.trim().length === 0)
      throw new TypeError("path must be a non-empty string");

    const depth =
      typeof args.depth === "number" && Number.isInteger(args.depth)
        ? Math.min(Math.max(0, args.depth), MAX_GRAPH_DEPTH)
        : 2;

    const snapshot = getSnapshot(validRoot);
    if (!snapshot)
      return {
        schemaVersion: 1,
        nodes: [],
        truncated: false,
        diagnostics: ["no-graph"],
      };

    const result = graphImpact(snapshot, args.path, {
      repositoryId: snapshot.repositoryId,
      limits: { depth, maxItems: MAX_GRAPH_NODES },
    });

    return {
      schemaVersion: 1,
      root: validRoot,
      startPath: args.path,
      nodes: result.nodes.map((n) => ({ id: n.id, kind: n.kind })),
      truncated: result.truncated,
      diagnostics: result.diagnostics,
    };
  });
}
