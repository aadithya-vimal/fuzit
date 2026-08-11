import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildFilePackageGraph } from "@fuzit/graph";
import { EXIT_CODES, type NormalizedAnalysis } from "@fuzit/schemas";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { isGraphPathInsideRepository } from "../src/commands/graph/register.js";

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

async function execute(args: readonly string[], repositoryRoot: string) {
  let stdout = "";
  let stderr = "";
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
    { repositoryRoot, environment: {} },
  );
  return { exitCode, stdout, stderr };
}

describe("graph CLI", () => {
  it("round-trips a built artifact through every persisted-graph command", async () => {
    const invocationRoot = await mkdtemp(join(tmpdir(), "fuzit-graph-cwd-"));
    const repositoryRoot = await mkdtemp(join(tmpdir(), "fuzit-graph-repo-"));
    await mkdir(join(repositoryRoot, ".git"));
    await mkdir(join(repositoryRoot, "src"));
    await writeFile(join(repositoryRoot, "src", "a.ts"), "export {};");
    const graphPath = join(repositoryRoot, ".fuzit-final-graph.json");

    const built = await execute(
      ["graph", "build", "--root", repositoryRoot, "--output", graphPath],
      invocationRoot,
    );
    expect(built.exitCode).toBe(0);
    expect(built.stderr).toContain("Building repository graph");

    const persisted = JSON.parse(await readFile(graphPath, "utf8"));
    const repositoryNode = persisted.nodes.find(
      (node: { kind: string }) => node.kind === "repository",
    );
    expect(repositoryNode).toBeDefined();

    const stats = await execute(
      ["graph", "stats", "--input", graphPath],
      invocationRoot,
    );
    expect(stats.exitCode).toBe(0);
    expect(JSON.parse(stats.stdout)).toMatchObject({ nodes: 2, edges: 1 });
    expect(stats.stderr).toContain("Reading graph statistics");
    expect(stats.stderr).not.toContain("Building repository graph");

    const neighbors = await execute(
      ["graph", "neighbors", "--input", graphPath, repositoryNode.id],
      invocationRoot,
    );
    expect(neighbors.exitCode).toBe(0);
    expect(neighbors.stdout).toContain("file\tsrc/a.ts");
    expect(neighbors.stderr).toContain("Finding graph neighbors");

    const impact = await execute(
      ["graph", "impact", "--input", graphPath, repositoryNode.id],
      invocationRoot,
    );
    expect(impact.exitCode).toBe(0);
    expect(impact.stderr).toContain("Analyzing graph impact");

    const query = await execute(
      ["graph", "query", "--input", graphPath, "--kind", "file"],
      invocationRoot,
    );
    expect(query.exitCode).toBe(0);
    expect(query.stdout).toContain("file\tsrc/a.ts");
    expect(query.stderr).toContain("Querying repository graph");
  });

  it("rejects outside artifacts and traversal even with a valid graph", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "fuzit-graph-safe-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "fuzit-graph-outside-"));
    const outsideGraph = join(outsideRoot, "graph.json");
    const graph = buildFilePackageGraph({
      analysis,
      revision: "r1",
      packages: [],
    });
    await writeFile(outsideGraph, JSON.stringify(graph));

    const absolute = await execute(
      ["graph", "stats", "--root", repositoryRoot, "--input", outsideGraph],
      repositoryRoot,
    );
    expect(absolute.exitCode).toBe(EXIT_CODES.validation);
    expect(absolute.stderr).toContain(
      "Graph input must remain inside the repository root",
    );

    const traversal = await execute(
      [
        "graph",
        "stats",
        "--root",
        repositoryRoot,
        "--input",
        relative(repositoryRoot, outsideGraph),
      ],
      repositoryRoot,
    );
    expect(traversal.exitCode).toBe(EXIT_CODES.validation);
    expect(traversal.stderr).toContain("repository root");
  });

  it("uses correct Windows and POSIX containment semantics", () => {
    expect(
      isGraphPathInsideRepository(
        "C:\\Work\\Repo",
        "c:\\work\\repo\\.fuzit\\graph.json",
      ),
    ).toBe(true);
    expect(
      isGraphPathInsideRepository("C:\\Work\\Repo", "D:\\graph.json"),
    ).toBe(false);
    expect(
      isGraphPathInsideRepository("/work/repo", "/work/repo/.fuzit/graph.json"),
    ).toBe(true);
    expect(isGraphPathInsideRepository("/work/repo", "/work/graph.json")).toBe(
      false,
    );
  });

  it("builds graph statistics directly from a repository", async () => {
    const result = await run(["--json", "graph", "stats"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      nodes: expect.any(Number),
      edges: expect.any(Number),
    });
    expect(result.stderr).toBe("");
  });

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
    expect(neighbors.stderr).toContain("Finding graph neighbors");
    expect(neighbors.stderr).toContain("graph complete");
  });
  it("routes partial diagnostics to stderr and preserves safe stdout", async () => {
    const result = await run(
      ["graph", "query", "--input", "graph.json", "--kind", "file"],
      true,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("file\tsrc/a.ts\n");
    expect(result.stderr).toContain(
      "warning GRAPH.PARTIAL: parser unavailable\n",
    );
    expect(result.stderr).toContain("Querying repository graph");
    expect(result.stderr).toContain("graph complete");
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
