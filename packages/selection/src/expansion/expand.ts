export type ExpansionRelationship =
  "dependency" | "reverse-dependency" | "test";

export interface ExpansionEdge {
  readonly from: string;
  readonly to: string;
  readonly relationship: ExpansionRelationship;
  readonly resolved: boolean;
  readonly confidence?: number;
}

export interface ExpansionBounds {
  readonly maximumDepth: number;
  readonly maximumItems: number;
  readonly maximumEdges: number;
  readonly minimumConfidence: number;
  readonly tokenBudget: number;
}

export interface ExpandedCandidate {
  readonly path: string;
  readonly depth: number;
  readonly contribution: number;
  readonly relationshipPath: readonly string[];
  readonly origin: string;
  readonly edgeTypes: readonly ExpansionRelationship[];
  readonly reason: "required-anchor" | "initial-candidate" | "graph-expansion";
  readonly bounds: ExpansionBounds;
  readonly budgetDecision: "included";
  readonly securityDecision: "allowed";
}

export interface ExpansionOptions {
  readonly depth: number;
  readonly decay: number;
  readonly cap: number;
  readonly maximumEdges?: number;
  readonly minimumConfidence?: number;
  readonly tokenBudget?: number;
  readonly tokenCosts?: Readonly<Record<string, number>>;
  readonly allowedRelationships?: readonly ExpansionRelationship[];
  readonly requiredAnchors?: readonly string[];
  readonly securityAllowedPaths?: readonly string[];
  readonly signal?: AbortSignal;
}

/** Deterministic bounded expansion over approved, resolved graph edges. */
export function expandDependencies(
  seeds: readonly string[],
  edges: readonly ExpansionEdge[],
  options: ExpansionOptions,
): ExpandedCandidate[] {
  const anchors = [...new Set(options.requiredAnchors ?? [])].sort();
  const initial = [
    ...anchors,
    ...[...new Set(seeds)].sort().filter((path) => !anchors.includes(path)),
  ];
  const maximumItems = Math.max(options.cap, anchors.length);
  const bounds: ExpansionBounds = {
    maximumDepth: Math.max(0, options.depth),
    maximumItems,
    maximumEdges: Math.max(0, options.maximumEdges ?? edges.length),
    minimumConfidence: Math.max(0, Math.min(1, options.minimumConfidence ?? 0)),
    tokenBudget: Math.max(0, options.tokenBudget ?? Number.MAX_SAFE_INTEGER),
  };
  const allowedRelationships = new Set(
    options.allowedRelationships ?? [
      "dependency",
      "reverse-dependency",
      "test",
    ],
  );
  const securityAllowed =
    options.securityAllowedPaths === undefined
      ? null
      : new Set(options.securityAllowedPaths);
  const queue = initial.map((path) => ({
    path,
    depth: 0,
    contribution: 1,
    relationshipPath: [path],
    origin: path,
    edgeTypes: [] as ExpansionRelationship[],
  }));
  const seen = new Set<string>();
  const result: ExpandedCandidate[] = [];
  let traversedEdges = 0;
  let usedTokens = 0;
  while (
    queue.length &&
    result.length < bounds.maximumItems &&
    !options.signal?.aborted
  ) {
    const current = queue.shift()!;
    if (seen.has(current.path)) continue;
    const required = anchors.includes(current.path);
    if (!required && securityAllowed && !securityAllowed.has(current.path))
      continue;
    const cost = Math.max(0, options.tokenCosts?.[current.path] ?? 1);
    if (!required && usedTokens + cost > bounds.tokenBudget) continue;
    seen.add(current.path);
    usedTokens += cost;
    result.push({
      ...current,
      reason: required
        ? "required-anchor"
        : current.depth === 0
          ? "initial-candidate"
          : "graph-expansion",
      bounds,
      budgetDecision: "included",
      securityDecision: "allowed",
    });
    if (current.depth >= bounds.maximumDepth) continue;
    for (const edge of edges
      .filter(
        (edge) =>
          edge.resolved &&
          allowedRelationships.has(edge.relationship) &&
          (edge.confidence ?? 1) >= bounds.minimumConfidence &&
          (edge.from === current.path || edge.to === current.path),
      )
      .sort((a, b) =>
        `${a.relationship}:${a.from}:${a.to}`.localeCompare(
          `${b.relationship}:${b.from}:${b.to}`,
        ),
      )) {
      if (traversedEdges >= bounds.maximumEdges) break;
      traversedEdges += 1;
      const path = edge.from === current.path ? edge.to : edge.from;
      if (!seen.has(path))
        queue.push({
          path,
          depth: current.depth + 1,
          contribution: current.contribution * options.decay,
          relationshipPath: [
            ...current.relationshipPath,
            `${edge.relationship}:${path}`,
          ],
          origin: current.origin,
          edgeTypes: [...current.edgeTypes, edge.relationship],
        });
    }
  }
  return result;
}
