export interface DependencyEdge {
  readonly from: string;
  readonly specifier: string;
  readonly kind: "relative" | "workspace" | "external" | "dynamic";
  readonly resolved: boolean;
}

export function extractDependencies(
  path: string,
  source: string,
): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const pattern =
    /(?:import\s+(?:[^"'()]+?\s+from\s+)?|require\s*\(|import\s*\()\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1]!;
    const dynamic = match[0].startsWith("import(");
    const relative = specifier.startsWith(".");
    const workspace = specifier.startsWith("@") && !specifier.includes("/");
    edges.push({
      from: path,
      specifier,
      kind: dynamic
        ? "dynamic"
        : relative
          ? "relative"
          : workspace
            ? "workspace"
            : "external",
      resolved: relative && !specifier.includes("*"),
    });
  }
  return edges.sort((a, b) => a.specifier.localeCompare(b.specifier));
}

export function dependencyCycles(edges: readonly DependencyEdge[]): string[][] {
  return edges
    .filter(
      (edge) =>
        edge.resolved &&
        edge.specifier.includes(edge.from.replace(/\.[^.]+$/, "")),
    )
    .map((edge) => [edge.from, edge.specifier]);
}
