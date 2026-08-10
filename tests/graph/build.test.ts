import { describe, expect, it } from "vitest";
import { buildFilePackageGraph } from "@fuzit/graph";
import type { NormalizedAnalysis } from "@fuzit/schemas";

const repositoryId = `sha256:${"a".repeat(64)}`;
const file = (path: string, index: number) => ({
  id: `analysis:file:${index.toString(16).padStart(64, "0")}`,
  repositoryId,
  kind: "file" as const,
  path,
  language: path.endsWith(".go") ? "go" : "typescript",
  contentHash: `sha256:${index.toString(16).padStart(64, "0")}`,
});
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: [file("apps/web/src/a.ts", 1), file("services/go/main.go", 2)],
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};

describe("file and package graph", () => {
  it("builds deterministic nested polyglot containment and dependencies", () => {
    const packages = [
      {
        name: "root",
        path: ".",
        manifestPath: "package.json",
        dependencies: ["web"],
      },
      {
        name: "web",
        path: "apps/web",
        manifestPath: "apps/web/package.json",
        dependencies: [],
      },
      {
        name: "go",
        path: "services/go",
        manifestPath: "services/go/go.mod",
        dependencies: [],
      },
    ];
    const first = buildFilePackageGraph({ analysis, revision: "r1", packages });
    expect(
      buildFilePackageGraph({
        analysis,
        revision: "r1",
        packages: [...packages].reverse(),
      }),
    ).toEqual(first);
    expect(
      first.nodes
        .filter((node) => node.kind === "file")
        .map((node) => node.parentId),
    ).not.toContain(first.nodes.find((node) => node.kind === "repository")?.id);
  });
  it("reports conflicting manifests and unresolved dependencies", () => {
    const graph = buildFilePackageGraph({
      analysis,
      revision: "r1",
      packages: [
        {
          name: "duplicate",
          path: "apps/a",
          manifestPath: "apps/a/package.json",
          dependencies: ["missing"],
        },
        {
          name: "duplicate",
          path: "apps/b",
          manifestPath: "apps/b/package.json",
          dependencies: [],
        },
      ],
    });
    expect(graph.completeness).toBe("partial");
    expect(graph.diagnostics).toEqual([
      "conflicting package manifest name: duplicate",
    ]);
    expect(graph.edges.some((edge) => edge.resolution === "unresolved")).toBe(
      true,
    );
  });
});
