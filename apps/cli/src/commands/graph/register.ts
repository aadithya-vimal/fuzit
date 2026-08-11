import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { toRepositoryRelativePath } from "@fuzit/core";
import {
  buildFilePackageGraph,
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
import {
  acquireRepository,
  repositoryIdentity,
} from "../../application/repository.js";

interface GraphCommandDependencies {
  readonly repositoryRoot: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
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
  const [canonicalRoot, canonicalPath] = await Promise.all([
    realpath(root),
    realpath(path),
  ]);
  if (!isGraphPathInsideRepository(canonicalRoot, canonicalPath))
    throw new Error("Graph input must remain inside the repository root");
  const value: unknown = JSON.parse(
    (await readFile(canonicalPath, "utf8")).replace(/^\uFEFF/, ""),
  );
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

export function isGraphPathInsideRepository(
  repositoryRoot: string,
  graphPath: string,
): boolean {
  try {
    toRepositoryRelativePath(repositoryRoot, graphPath);
    return true;
  } catch {
    return false;
  }
}

async function hasGitMetadata(directory: string): Promise<boolean> {
  try {
    await stat(join(directory, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function findContainingGitRepository(
  startDirectory: string,
): Promise<string | null> {
  let directory = await realpath(startDirectory);
  while (true) {
    if (await hasGitMetadata(directory)) return directory;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

async function resolveGraphInput(
  defaultRoot: string,
  input: string,
  explicitRoot?: string,
): Promise<{ readonly root: string; readonly input: string }> {
  const requestedRoot = explicitRoot
    ? resolve(defaultRoot, explicitRoot)
    : defaultRoot;
  const inputPath = isAbsolute(input)
    ? resolve(input)
    : resolve(requestedRoot, input);

  if (explicitRoot) return { root: requestedRoot, input: inputPath };

  const containingRoot = await findContainingGitRepository(dirname(inputPath));
  if (containingRoot && isGraphPathInsideRepository(containingRoot, inputPath))
    return { root: containingRoot, input: inputPath };

  const canonicalDefaultRoot = await realpath(defaultRoot);
  if (isGraphPathInsideRepository(canonicalDefaultRoot, inputPath))
    return { root: canonicalDefaultRoot, input: inputPath };

  throw new Error(
    "Graph input is outside the current repository root. Pass --root <repository> for an artifact inside another repository.",
  );
}
async function buildRepositoryGraph(
  root: string,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<GraphSnapshot> {
  const acquisition = await acquireRepository(root, environment);
  const identity = await repositoryIdentity(root);
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const repositoryId = `sha256:${hash(identity.fingerprint)}` as const;
  return buildFilePackageGraph({
    analysis: {
      schemaVersion: 1,
      repositoryId,
      analysisIdentity: `analysis:repository:${hash(identity.fingerprint)}`,
      files: acquisition.items.map((item) => ({
        id: `analysis:file:${hash(item.path)}`,
        repositoryId,
        kind: "file" as const,
        path: item.path,
        language: "text",
        contentHash: `sha256:${item.sha256}`,
      })),
      modules: [],
      symbols: [],
      relationships: [],
      completeness: acquisition.complete ? "complete" : "partial",
      diagnostics: acquisition.omissions
        .filter(({ failure }) => failure)
        .map(({ path, reason }) => `${path}: ${reason}`)
        .slice(0, 128),
    },
    revision: identity.revision ?? `working-tree:${identity.fingerprint}`,
    packages: [],
  });
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
    command
      .option(
        "--input <path>",
        "graph JSON path; its containing Git repository is used when --root is omitted",
      )
      .option(
        "--root <path>",
        "repository root that must contain --input; defaults to the input artifact's Git repository",
      );
  const run = async (
    options: {
      input?: string;
      root?: string;
      node?: string;
      depth?: string;
      limit?: string;
      kind?: string;
    },
    operation: "stats" | "neighbors" | "impact" | "query",
  ) => {
    try {
      const root = resolve(dependencies.repositoryRoot, options.root ?? ".");
      const snapshot = options.input
        ? await resolveGraphInput(
            dependencies.repositoryRoot,
            options.input,
            options.root,
          ).then((resolved) => loadGraph(resolved.root, resolved.input))
        : await buildRepositoryGraph(root, dependencies.environment);
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
      if (dependencies.json || operation === "stats") {
        dependencies.writeData(result);
      } else {
        dependencies.writeData(humanNodes(result as ReturnType<typeof graphQuery>));
      }
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
  graph
    .command("build")
    .description("build a repository graph snapshot")
    .option("--root <path>", "repository root", ".")
    .option("--output <path>", "output graph JSON", ".fuzit/graph.json")
    .action(async (options: { root: string; output: string }) => {
      try {
        const root = resolve(dependencies.repositoryRoot, options.root);
        const snapshot = await buildRepositoryGraph(
          root,
          dependencies.environment,
        );
        const output = resolve(root, options.output);
        const rel = relative(root, output);
        if (rel.startsWith("..") || isAbsolute(rel))
          throw new Error(
            "Graph output must remain inside the repository root",
          );
        await mkdir(resolve(output, ".."), { recursive: true });
        await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, {
          encoding: "utf8",
          flag: "wx",
        });
        dependencies.writeData({
          output,
          nodes: snapshot.nodes.length,
          edges: snapshot.edges.length,
          completeness: snapshot.completeness,
        });
      } catch (error) {
        dependencies.writeDiagnostic(
          diagnostic(
            "error",
            error instanceof Error ? error.message : String(error),
          ),
        );
        dependencies.setExitCode(EXIT_CODES.validation);
      }
    });
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
