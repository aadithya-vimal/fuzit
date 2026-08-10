import { describe, expect, it } from "vitest";
import { buildFilePackageGraph } from "@fuzit/graph";
import { scoreMetadataRelevance } from "@fuzit/selection";
import type { NormalizedAnalysis } from "@fuzit/schemas";
const repositoryId = `sha256:${"a".repeat(64)}`;
const hash = (n: number) => n.toString(16).padStart(64, "0");
const paths = [
  "apps/web/src/app.ts",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "services/api/main.go",
  "services/api/go.mod",
  "services/other/go.mod",
];
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: paths.map((path, index) => ({
    id: `analysis:file:${hash(index + 1)}`,
    repositoryId,
    kind: "file",
    path,
    language: path.endsWith(".go") ? "go" : "typescript",
    contentHash: `sha256:${hash(index + 20)}`,
  })),
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};
const graph = buildFilePackageGraph({
  analysis,
  revision: "r1",
  packages: [
    {
      name: "web",
      path: "apps/web",
      manifestPath: "apps/web/package.json",
      dependencies: [],
    },
    {
      name: "api",
      path: "services/api",
      manifestPath: "services/api/go.mod",
      dependencies: [],
    },
    {
      name: "other",
      path: "services/other",
      manifestPath: "services/other/go.mod",
      dependencies: [],
    },
  ],
});
const node = (path: string) => graph.nodes.find((item) => item.path === path)!;

describe("manifest and configuration relevance", () => {
  it("selects nested package metadata in a polyglot monorepo", () => {
    const web = scoreMetadataRelevance(graph, [node("apps/web/src/app.ts").id]);
    expect(web.map((item) => item.nodeId)).toEqual(
      expect.arrayContaining([
        node("apps/web/package.json").id,
        node("apps/web/tsconfig.json").id,
      ]),
    );
    expect(
      web.some((item) => item.nodeId === node("services/api/go.mod").id),
    ).toBe(false);
    const api = scoreMetadataRelevance(graph, [
      node("services/api/main.go").id,
    ]);
    expect(api.map((item) => item.nodeId)).toContain(
      node("services/api/go.mod").id,
    );
    expect(api.map((item) => item.nodeId)).not.toContain(
      node("services/other/go.mod").id,
    );
  });
  it("bounds metadata expansion", () =>
    expect(() => scoreMetadataRelevance(graph, [], 201)).toThrow(/limit/u));
});
