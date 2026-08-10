import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFilePackageGraph } from "@fuzit/graph";
import { EXIT_CODES, type NormalizedAnalysis } from "@fuzit/schemas";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

const repositoryId = `sha256:${"a".repeat(64)}`;
const analysis: NormalizedAnalysis = {
  schemaVersion: 1,
  repositoryId,
  analysisIdentity: "fixture",
  files: [
    {
      id: `analysis:file:${"1".padStart(64, "0")}`,
      repositoryId,
      kind: "file",
      path: "src/a.ts",
      language: "typescript",
      contentHash: `sha256:${"2".padStart(64, "0")}`,
    },
  ],
  modules: [],
  symbols: [],
  relationships: [],
  completeness: "complete",
  diagnostics: [],
};
async function run(args: readonly string[], partial = false) {
  const root = await mkdtemp(join(tmpdir(), "fuzit-graph-cli-"));
  let stdout = "";
  let stderr = "";
  const graph = buildFilePackageGraph({
    analysis,
    revision: "r1",
    packages: [],
  });
  await writeFile(
    join(root, "graph.json"),
    JSON.stringify(
      partial
        ? {
            ...graph,
            completeness: "partial",
            diagnostics: ["parser unavailable"],
          }
        : graph,
    ),
  );
  const exitCode = await runCli(
    args,
    {
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
    },
    { repositoryRoot: root, environment: {} },
  );
  return { exitCode, stdout, stderr, graph };
}

describe("graph CLI", () => {
  it("returns deterministic JSON stats and human neighbors", async () => {
    const stats = await run([
      "--json",
      "graph",
      "stats",
      "--input",
      "graph.json",
    ]);
    expect(stats.exitCode).toBe(0);
    expect(JSON.parse(stats.stdout)).toMatchObject({
      schemaVersion: 1,
      nodes: 2,
      edges: 1,
    });
    expect(stats.stderr).toBe("");
    const repositoryNode = stats.graph.nodes.find(
      (node) => node.kind === "repository",
    )!;
    const neighbors = await run([
      "graph",
      "neighbors",
      repositoryNode.id,
      "--input",
      "graph.json",
    ]);
    expect(neighbors.exitCode).toBe(0);
    expect(neighbors.stdout).toContain("file\tsrc/a.ts");
    expect(neighbors.stderr).toBe("");
  });
  it("routes partial diagnostics to stderr and preserves safe stdout", async () => {
    const result = await run(
      ["graph", "query", "--input", "graph.json", "--kind", "file"],
      true,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("file\tsrc/a.ts\n");
    expect(result.stderr).toBe("warning GRAPH.PARTIAL: parser unavailable\n");
  });
  it("uses validation exit codes for bounds and root escape", async () => {
    const bounded = await run([
      "graph",
      "query",
      "--input",
      "graph.json",
      "--limit",
      "1001",
    ]);
    expect(bounded.exitCode).toBe(EXIT_CODES.validation);
    expect(bounded.stdout).toBe("");
    expect(bounded.stderr).toContain("item limit");
    const escaped = await run(["graph", "stats", "--input", "../graph.json"]);
    expect(escaped.exitCode).toBe(EXIT_CODES.validation);
    expect(escaped.stderr).toContain("repository root");
  });
});
