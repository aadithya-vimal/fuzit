import { describe, expect, it } from "vitest";
import {
  applyGraphTransaction,
  buildFilePackageGraph,
  withGraphTransactions,
} from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";
const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (n: number) => n.toString(16).padStart(64, "0");
const analysis = (paths: readonly string[]): NormalizedAnalysis => ({
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: paths.map((path, i) => ({
    id: `analysis:file:${hash(i + 1)}`,
    repositoryId,
    kind: "file",
    path,
    language: "typescript",
    contentHash: `sha256:${hash(i + 20)}`,
  })),
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
});

describe("graph transactions", () => {
  it("atomically tombstones deleted nodes and incident edges", () => {
    const current = withGraphTransactions(
      buildFilePackageGraph({
        analysis: analysis(["a.ts", "b.ts"]),
        revision: "r1",
        packages: [],
      }),
    );
    const deleted = current.nodes.find((node) => node.path === "a.ts")!;
    const next = applyGraphTransaction(current, {
      revision: "r2",
      deleteNodeIds: [deleted.id],
    });
    expect(next.nodes.some((node) => node.id === deleted.id)).toBe(false);
    expect(
      next.edges.some(
        (edge) => edge.sourceId === deleted.id || edge.targetId === deleted.id,
      ),
    ).toBe(false);
    expect(next.tombstones.some((item) => item.id === deleted.id)).toBe(true);
  });
  it("preserves the old snapshot when interrupted before commit", () => {
    const current = withGraphTransactions(
      buildFilePackageGraph({
        analysis: analysis(["a.ts"]),
        revision: "r1",
        packages: [],
      }),
    );
    const before = JSON.stringify(current);
    expect(() =>
      applyGraphTransaction(current, {
        revision: "r2",
        deleteNodeIds: [current.nodes.find((node) => node.path === "a.ts")!.id],
        beforeCommit: () => {
          throw new Error("interrupted");
        },
      }),
    ).toThrow("interrupted");
    expect(JSON.stringify(current)).toBe(before);
  });
  it("matches clean file nodes after add, delete, and rename replacements", () => {
    const oldState = withGraphTransactions(
      buildFilePackageGraph({
        analysis: analysis(["old.ts"]),
        revision: "r1",
        packages: [],
      }),
    );
    const clean = buildFilePackageGraph({
      analysis: analysis(["new.ts", "added.ts"]),
      revision: "r2",
      packages: [],
    });
    const updated = applyGraphTransaction(oldState, {
      revision: "r2",
      deleteNodeIds: oldState.nodes
        .filter((node) => node.kind === "file")
        .map((node) => node.id),
      replaceNodes: clean.nodes.filter((node) => node.kind === "file"),
      replaceEdges: clean.edges.filter((edge) => edge.targetKind === "file"),
    });
    expect(updated.nodes.filter((node) => node.kind === "file")).toEqual(
      clean.nodes.filter((node) => node.kind === "file"),
    );
  });
});
