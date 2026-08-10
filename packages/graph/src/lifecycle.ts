import type { GraphSnapshot } from "./build.js";
import { createGraphEdge } from "./edges.js";
import { createGraphNode } from "./nodes.js";

export interface GraphChangeInput {
  readonly revision: string;
  readonly path: string;
  readonly previousPath?: string;
  readonly introduced?: boolean;
  readonly changedWith?: readonly string[];
}
export interface MaterializeLifecycleOptions {
  readonly historyAvailable: boolean;
  readonly shallow: boolean;
  readonly changes: readonly GraphChangeInput[];
}

export function materializeLifecycleRelations(
  snapshot: GraphSnapshot,
  options: MaterializeLifecycleOptions,
): GraphSnapshot {
  const nodes = [...snapshot.nodes];
  const edges = [...snapshot.edges];
  const diagnostics = [...snapshot.diagnostics];
  if (!options.historyAvailable) diagnostics.push("git history unavailable");
  if (options.shallow)
    diagnostics.push("git history is shallow; lifecycle evidence is partial");
  for (const change of [...options.changes].sort(
    (a, b) =>
      a.revision.localeCompare(b.revision) || a.path.localeCompare(b.path),
  )) {
    const file = nodes.find(
      (node) => node.kind === "file" && node.path === change.path,
    );
    if (!file) {
      diagnostics.push(`changed file unavailable: ${change.path}`);
      continue;
    }
    const changeNode = createGraphNode({
      repositoryId: snapshot.repositoryId,
      kind: "change",
      identity: `${change.revision}\0${change.path}`,
      path: change.path,
      parentId: nodes.find((node) => node.kind === "repository")!.id,
      provenance: {
        collector: "git",
        collectorVersion: "1",
        basis: "observed",
        revision: change.revision,
        sourcePath: change.path,
        sourceRange: null,
      },
    });
    nodes.push(changeNode);
    const evidence = [
      {
        basis: "direct" as const,
        collector: "git",
        collectorVersion: "1",
        sourcePath: change.path,
        reason: change.previousPath
          ? `renamed from ${change.previousPath}`
          : "observed Git change",
      },
    ];
    edges.push(
      createGraphEdge({
        repositoryId: snapshot.repositoryId,
        kind: "modifies",
        sourceId: changeNode.id,
        sourceKind: "change",
        targetId: file.id,
        targetKind: "file",
        unresolvedTarget: null,
        resolution: "resolved",
        evidence,
        revision: { validFrom: change.revision, validThrough: null },
      }),
    );
    if (change.introduced)
      edges.push(
        createGraphEdge({
          repositoryId: snapshot.repositoryId,
          kind: "introduced-by",
          sourceId: file.id,
          sourceKind: "file",
          targetId: changeNode.id,
          targetKind: "change",
          unresolvedTarget: null,
          resolution: "resolved",
          evidence,
          revision: { validFrom: change.revision, validThrough: null },
        }),
      );
    for (const peerPath of [...(change.changedWith ?? [])].sort()) {
      const peer = nodes.find(
        (node) => node.kind === "file" && node.path === peerPath,
      );
      if (peer)
        edges.push(
          createGraphEdge({
            repositoryId: snapshot.repositoryId,
            kind: "changed-with",
            sourceId: file.id,
            sourceKind: "file",
            targetId: peer.id,
            targetKind: "file",
            unresolvedTarget: null,
            resolution: "resolved",
            evidence,
            revision: { validFrom: change.revision, validThrough: null },
          }),
        );
    }
  }
  return {
    ...snapshot,
    nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: diagnostics.sort(),
    completeness: diagnostics.length ? "partial" : snapshot.completeness,
  };
}
