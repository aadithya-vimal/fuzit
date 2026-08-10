import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  graphImpact,
  graphNeighbors,
  graphQuery,
  graphStats,
  type GraphSnapshot,
} from "@fuzit/graph";
import {
  EXIT_CODES,
  parseGraphEdge,
  parseGraphNode,
  type Diagnostic,
  type ExitCode,
  type GraphNodeKind,
} from "@fuzit/schemas";
import type { Command } from "commander";

interface GraphCommandDependencies {
  readonly repositoryRoot: string;
  readonly json: boolean;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (value: Diagnostic) => void;
  readonly setExitCode: (code: ExitCode) => void;
}
const diagnostic = (
  severity: "warning" | "error",
  message: string,
): Diagnostic => ({
  schemaVersion: 1,
  code: severity === "error" ? "CLI.INVALID_ARGUMENT" : "GRAPH.PARTIAL",
  severity,
  source: "graph",
  message,
});
async function loadGraph(root: string, input: string): Promise<GraphSnapshot> {
  const path = resolve(root, input);
  const rel = relative(root, path);
  if (
    rel === ".." ||
    rel.startsWith(`..\\`) ||
    rel.startsWith("../") ||
    isAbsolute(rel)
  )
    throw new Error("Graph input must remain inside the repository root");
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    !("repositoryId" in value) ||
    !("nodes" in value) ||
    !("edges" in value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  )
    throw new Error("Graph input schema is invalid");
  return {
    schemaVersion: 1,
    repositoryId: String(value.repositoryId),
    nodes: value.nodes.map(parseGraphNode),
    edges: value.edges.map(parseGraphEdge),
    diagnostics:
      "diagnostics" in value && Array.isArray(value.diagnostics)
        ? value.diagnostics.map(String).slice(0, 128)
        : [],
    completeness:
      "completeness" in value && value.completeness === "partial"
        ? "partial"
        : "complete",
  };
}
const humanNodes = (result: ReturnType<typeof graphQuery>) =>
  [
    ...result.nodes.map((node) => `${node.kind}\t${node.path ?? node.id}`),
    ...result.diagnostics,
  ].join("\n");
export function registerGraphCommand(
  program: Command,
  dependencies: GraphCommandDependencies,
): void {
  const graph = program
    .command("graph")
    .description("query a bounded local context graph");
  const input = (command: Command) =>
    command.requiredOption(
      "--input <path>",
      "repository-relative graph JSON path",
    );
  const run = async (
    options: {
      input: string;
      node?: string;
      depth?: string;
      limit?: string;
      kind?: string;
    },
    operation: "stats" | "neighbors" | "impact" | "query",
  ) => {
    try {
      const snapshot = await loadGraph(
        dependencies.repositoryRoot,
        options.input,
      );
      const limits = {
        depth: Number(options.depth ?? 1),
        maxItems: Number(options.limit ?? 100),
      };
      const result =
        operation === "stats"
          ? graphStats(snapshot)
          : operation === "query"
            ? graphQuery(snapshot, {
                repositoryId: snapshot.repositoryId,
                limits,
                ...(options.kind
                  ? { nodeKinds: [options.kind as GraphNodeKind] }
                  : {}),
              })
            : (operation === "impact" ? graphImpact : graphNeighbors)(
                snapshot,
                options.node!,
                { repositoryId: snapshot.repositoryId, limits },
              );
      dependencies.writeData(
        dependencies.json || operation === "stats"
          ? result
          : humanNodes(result as ReturnType<typeof graphQuery>),
      );
      if (snapshot.completeness === "partial")
        for (const message of snapshot.diagnostics)
          dependencies.writeDiagnostic(diagnostic("warning", message));
    } catch (error) {
      dependencies.writeDiagnostic(
        diagnostic(
          "error",
          error instanceof Error ? error.message : String(error),
        ),
      );
      dependencies.setExitCode(EXIT_CODES.validation);
    }
  };
  input(
    graph.command("stats").description("show deterministic graph statistics"),
  ).action((options) => run(options, "stats"));
  input(
    graph
      .command("neighbors <node>")
      .description("show bounded graph neighbors")
      .option("--depth <n>", "maximum traversal depth", "1")
      .option("--limit <n>", "maximum returned items", "100"),
  ).action((node, options) => run({ ...options, node }, "neighbors"));
  input(
    graph
      .command("impact <node>")
      .description("show bounded impact neighbors")
      .option("--depth <n>", "maximum traversal depth", "2")
      .option("--limit <n>", "maximum returned items", "100"),
  ).action((node, options) => run({ ...options, node }, "impact"));
  input(
    graph
      .command("query")
      .description("filter bounded graph nodes")
      .option("--kind <kind>", "graph node kind")
      .option("--limit <n>", "maximum returned items", "100"),
  ).action((options) => run(options, "query"));
}
