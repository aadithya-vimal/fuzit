import { describe, expect, it } from "vitest";
import {
  buildFilePackageGraph,
  materializeLifecycleRelations,
} from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";
const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (n: number) => n.toString(16).padStart(64, "0");
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: ["src/new.ts", "src/peer.ts"].map((path, i) => ({
    id: `analysis:file:${hash(i + 1)}`,
    repositoryId,
    kind: "file",
    path,
    language: "typescript",
    contentHash: `sha256:${hash(i + 3)}`,
  })),
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};
const base = buildFilePackageGraph({ analysis, revision: "r2", packages: [] });

describe("Git lifecycle graph relations", () => {
  it("retains rename, introduction, modification, and changed-with evidence", () => {
    const graph = materializeLifecycleRelations(base, {
      historyAvailable: true,
      shallow: false,
      changes: [
        {
          revision: "r2",
          path: "src/new.ts",
          previousPath: "src/old.ts",
          introduced: true,
          changedWith: ["src/peer.ts"],
        },
      ],
    });
    expect(
      graph.edges.filter((edge) =>
        ["modifies", "introduced-by", "changed-with"].includes(edge.kind),
      ),
    ).toHaveLength(3);
    expect(
      graph.edges.some(
        (edge) => edge.evidence[0]?.reason === "renamed from src/old.ts",
      ),
    ).toBe(true);
  });
  it("reports missing and shallow Git without inferring lifecycle certainty", () => {
    const graph = materializeLifecycleRelations(base, {
      historyAvailable: false,
      shallow: true,
      changes: [],
    });
    expect(graph.completeness).toBe("partial");
    expect(graph.diagnostics).toHaveLength(2);
    expect(
      graph.edges.some((edge) =>
        ["modifies", "introduced-by"].includes(edge.kind),
      ),
    ).toBe(false);
  });
});
