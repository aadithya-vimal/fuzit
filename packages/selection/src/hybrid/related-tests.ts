import type { GraphNode, GraphSnapshot } from "@fuzit/graph";

export interface RelatedTestScore {
  readonly nodeId: string;
  readonly value: number;
  readonly basis: string;
  readonly testKind: "unit" | "integration" | "e2e" | "unknown";
}

const classifyTestPath = (
  path: string | null,
): RelatedTestScore["testKind"] => {
  if (!path) return "unknown";
  const normalized = path.toLocaleLowerCase("en-US");
  if (/(^|\/)(e2e|end-to-end)(\/|$)|\.e2e\.[^.]+$/u.test(normalized))
    return "e2e";
  if (/(^|\/)(integration)(\/|$)|\.integration\.[^.]+$/u.test(normalized))
    return "integration";
  if (
    /(^|\/)(__tests__|tests?|spec)(\/|$)|\.(test|spec)\.[^.]+$/u.test(
      normalized,
    )
  )
    return "unit";
  return "unknown";
};

const testStem = (path: string) =>
  path
    .split("/")
    .at(-1)!
    .replace(/\.(test|spec|integration|e2e)?\.[^.]+$/u, "")
    .toLocaleLowerCase("en-US");

export function scoreRelatedTests(
  graph: GraphSnapshot,
  targetIds: readonly string[],
  maxResults = 50,
): readonly RelatedTestScore[] {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200) {
    throw new Error("Related-test result limit must be between 1 and 200");
  }
  const targets = new Set(targetIds);
  const targetNodes = graph.nodes.filter((node) => targets.has(node.id));
  const candidates = graph.nodes.filter(
    (node) => node.kind === "test" || classifyTestPath(node.path) !== "unknown",
  );
  const scores = new Map<string, RelatedTestScore>();
  const record = (node: GraphNode, value: number, basis: string) => {
    const previous = scores.get(node.id);
    if (
      !previous ||
      value > previous.value ||
      (value === previous.value && basis.localeCompare(previous.basis) < 0)
    ) {
      scores.set(node.id, {
        nodeId: node.id,
        value,
        basis,
        testKind: classifyTestPath(node.path),
      });
    }
  };
  for (const candidate of candidates) {
    const explicit = graph.edges.find(
      (edge) =>
        edge.kind === "tests" &&
        edge.sourceId === candidate.id &&
        edge.targetId !== null &&
        targets.has(edge.targetId),
    );
    if (explicit) {
      record(candidate, 1, `explicit tests edge to ${explicit.targetId}`);
      continue;
    }
    const imported = graph.edges.find(
      (edge) =>
        edge.kind === "imports" &&
        edge.sourceId === candidate.id &&
        edge.targetId !== null &&
        targets.has(edge.targetId),
    );
    if (imported) {
      record(candidate, 0.8, `parsed test import to ${imported.targetId}`);
      continue;
    }
    if (candidate.path) {
      const stem = testStem(candidate.path);
      const target = targetNodes.find(
        (node) => node.path && stem === testStem(node.path),
      );
      if (target)
        record(candidate, 0.6, `exact test naming convention for ${target.id}`);
      else if (
        targetNodes.some(
          (node) =>
            node.parentId !== null && node.parentId === candidate.parentId,
        )
      )
        record(candidate, 0.25, "same package test convention");
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.value - a.value || a.nodeId.localeCompare(b.nodeId))
    .slice(0, maxResults);
}
