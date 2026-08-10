import type { GraphEdge, GraphNode, NormalizedAnalysis } from "@fuzit/schemas";
import { createGraphEdge } from "./edges.js";
import { createGraphNode } from "./nodes.js";

export interface GraphDependencyInput {
  readonly name: string;
  readonly optional?: boolean;
}
export interface GraphPackageInput {
  readonly name: string;
  readonly path: string;
  readonly manifestPath: string;
  readonly dependencies: readonly (string | GraphDependencyInput)[];
}
export interface BuildFilePackageGraphInput {
  readonly analysis: NormalizedAnalysis;
  readonly revision: string;
  readonly packages: readonly GraphPackageInput[];
}
export interface GraphSnapshot {
  readonly schemaVersion: 1;
  readonly repositoryId: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly diagnostics: readonly string[];
  readonly completeness: "complete" | "partial";
}
const byId = <T extends { readonly id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);
const provenance = (revision: string, sourcePath: string | null) => ({
  collector: "graph-builder",
  collectorVersion: "1",
  basis: "observed" as const,
  revision,
  sourcePath,
  sourceRange: null,
});
const evidence = (sourcePath: string, reason: string) => [
  {
    basis: "direct" as const,
    collector: "graph-builder",
    collectorVersion: "1",
    sourcePath,
    reason,
  },
];

export function buildFilePackageGraph(
  input: BuildFilePackageGraphInput,
): GraphSnapshot {
  const { analysis, revision } = input;
  const diagnostics: string[] = [];
  const repository = createGraphNode({
    repositoryId: analysis.repositoryId,
    kind: "repository",
    identity: ".",
    path: null,
    parentId: null,
    provenance: provenance(revision, null),
  });
  const packages = [...input.packages].sort(
    (a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name),
  );
  const names = new Map<string, GraphNode[]>();
  const packageNodes = packages.map((item) => {
    const node = createGraphNode({
      repositoryId: analysis.repositoryId,
      kind: "package",
      identity: `${item.path}\0${item.name}`,
      path: item.path === "." ? null : item.path,
      parentId: repository.id,
      provenance: provenance(revision, item.manifestPath),
    });
    names.set(item.name, [...(names.get(item.name) ?? []), node]);
    return node;
  });
  for (const [name, matches] of names)
    if (matches.length > 1)
      diagnostics.push(`conflicting package manifest name: ${name}`);
  const packageByPath = new Map(
    packages.map((item, index) => [item.path, packageNodes[index]!]),
  );
  const nearestPackage = (path: string) =>
    [...packageByPath.entries()]
      .filter(
        ([root]) =>
          root === "." || path === root || path.startsWith(`${root}/`),
      )
      .sort(([a], [b]) => b.length - a.length || a.localeCompare(b))[0]?.[1] ??
    repository;
  const fileNodes = analysis.files.map((file) =>
    createGraphNode({
      repositoryId: analysis.repositoryId,
      kind: "file",
      identity: file.path,
      path: file.path,
      parentId: nearestPackage(file.path).id,
      provenance: provenance(revision, file.path),
    }),
  );
  const edges: GraphEdge[] = [...packageNodes, ...fileNodes].map((node) =>
    createGraphEdge({
      repositoryId: analysis.repositoryId,
      kind: "contains",
      sourceId: node.parentId!,
      sourceKind: node.parentId === repository.id ? "repository" : "package",
      targetId: node.id,
      targetKind: node.kind,
      unresolvedTarget: null,
      resolution: "resolved",
      evidence: evidence(
        node.provenance.sourcePath ?? "package.json",
        "canonical containment",
      ),
      revision: { validFrom: revision, validThrough: null },
    }),
  );
  packages.forEach((item, index) =>
    item.dependencies
      .map((dependency) =>
        typeof dependency === "string"
          ? { name: dependency, optional: false }
          : { name: dependency.name, optional: dependency.optional ?? false },
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((dependency) => {
        const matches = names.get(dependency.name) ?? [];
        edges.push(
          createGraphEdge({
            repositoryId: analysis.repositoryId,
            kind: "depends-on",
            sourceId: packageNodes[index]!.id,
            sourceKind: "package",
            targetId: matches.length === 1 ? matches[0]!.id : null,
            targetKind: matches.length === 1 ? "package" : null,
            unresolvedTarget: matches.length === 1 ? null : dependency.name,
            resolution: matches.length === 1 ? "resolved" : "unresolved",
            evidence: evidence(
              item.manifestPath,
              `${dependency.optional ? "optional " : ""}manifest dependency ${dependency.name}`,
            ),
            revision: { validFrom: revision, validThrough: null },
          }),
        );
      }),
  );
  return {
    schemaVersion: 1,
    repositoryId: analysis.repositoryId,
    nodes: [repository, ...packageNodes, ...fileNodes].sort(byId),
    edges: edges.sort(byId),
    diagnostics: diagnostics.sort(),
    completeness: diagnostics.length ? "partial" : "complete",
  };
}
