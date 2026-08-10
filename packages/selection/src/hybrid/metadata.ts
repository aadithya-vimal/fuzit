import type { GraphNode, GraphSnapshot } from "@fuzit/graph";

export interface MetadataRelevanceScore {
  readonly nodeId: string;
  readonly value: number;
  readonly basis: string;
}
const MANIFEST_PATTERN =
  /(^|\/)(package\.json|pnpm-workspace\.yaml|go\.mod|pyproject\.toml|pom\.xml|build\.gradle|cargo\.toml)$/iu;
const CONFIG_PATTERN =
  /(^|\/)(tsconfig(?:\.[^/]+)?\.json|[^/]+\.config\.[^/]+|\.fuzit\.ya?ml)$/iu;
const isMetadata = (node: GraphNode) =>
  node.kind === "configuration" ||
  (node.path !== null &&
    (MANIFEST_PATTERN.test(node.path) || CONFIG_PATTERN.test(node.path)));

export function scoreMetadataRelevance(
  graph: GraphSnapshot,
  targetIds: readonly string[],
  maxResults = 50,
): readonly MetadataRelevanceScore[] {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200)
    throw new Error("Metadata result limit must be between 1 and 200");
  const targets = new Set(targetIds);
  const targetNodes = graph.nodes.filter((node) => targets.has(node.id));
  const scores = new Map<string, MetadataRelevanceScore>();
  const record = (node: GraphNode, value: number, basis: string) => {
    const previous = scores.get(node.id);
    if (!previous || value > previous.value)
      scores.set(node.id, { nodeId: node.id, value, basis });
  };
  for (const node of graph.nodes.filter(isMetadata)) {
    const configured = graph.edges.find(
      (edge) =>
        edge.kind === "configures" &&
        edge.sourceId === node.id &&
        edge.targetId !== null &&
        targets.has(edge.targetId),
    );
    if (configured) {
      record(
        node,
        1,
        `explicit configuration relation to ${configured.targetId}`,
      );
      continue;
    }
    const packageNode = graph.nodes.find(
      (candidate) =>
        candidate.kind === "package" &&
        (targetNodes.some((target) => target.parentId === candidate.id) ||
          targets.has(candidate.id)),
    );
    if (packageNode && node.path) {
      const packagePath = packageNode.path;
      const nested =
        packagePath === null ||
        node.path === packagePath ||
        node.path.startsWith(`${packagePath}/`);
      if (nested)
        record(
          node,
          MANIFEST_PATTERN.test(node.path) ? 0.8 : 0.6,
          `nearest package metadata for ${packageNode.id}`,
        );
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.value - a.value || a.nodeId.localeCompare(b.nodeId))
    .slice(0, maxResults);
}
