import {
  createFileContextItem,
  normalizeRepositoryRelativePath,
} from "@fuzit/core";
import { loadEffectiveConfig } from "@fuzit/config";
import {
  canonicalizeRepositoryRootList,
  RepositoryRootError,
  resolveRepositoryRoots,
} from "@fuzit/discovery";
import {
  evaluateBuiltInExclusion,
  loadGitignoreRulesForPath,
  loadFuzitignoreRulesForPath,
  evaluateIgnorePrecedence,
  type ExplicitPathRule,
  classifyFile,
  readTextContent,
  traverseDirectory,
} from "@fuzit/scanner";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";

interface ScanCommandDependencies {
  readonly currentDirectory: string;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

type ScanMode =
  | "explainPath"
  | "paths"
  | "metadata"
  | "items"
  | "content"
  | "summary"
  | "listRoots";

interface ScanOptions {
  readonly explainPath?: string;
  readonly root?: string;
  readonly listRoots?: boolean;
  readonly paths?: boolean;
  readonly include: string[];
  readonly exclude: string[];
  readonly metadata?: boolean;
  readonly items?: boolean;
  readonly content?: boolean;
  readonly summary?: boolean;
}

const scanModeFlags: ReadonlyArray<
  readonly [ScanMode, keyof ScanOptions, string]
> = [
  ["explainPath", "explainPath", "--explain-path"],
  ["paths", "paths", "--paths"],
  ["metadata", "metadata", "--metadata"],
  ["items", "items", "--items"],
  ["content", "content", "--content"],
  ["summary", "summary", "--summary"],
  ["listRoots", "listRoots", "--list-roots"],
];

function resolveScanMode(options: ScanOptions):
  | { readonly mode: ScanMode; readonly conflict?: undefined }
  | {
      readonly mode?: undefined;
      readonly conflict: readonly string[];
    } {
  const selected = scanModeFlags.filter(([, property]) =>
    property === "explainPath"
      ? options.explainPath !== undefined
      : options[property] === true,
  );
  if (selected.length > 1)
    return { conflict: selected.map(([, , flag]) => flag) };
  return { mode: selected[0]?.[0] ?? "summary" };
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function explicitRules(
  includes: readonly string[],
  excludes: readonly string[],
  source: string,
): ExplicitPathRule[] {
  return [
    ...includes.map((pattern) => ({
      pattern,
      action: "include" as const,
      reason: `${source} include`,
    })),
    ...excludes.map((pattern) => ({
      pattern,
      action: "exclude" as const,
      reason: `${source} exclude`,
    })),
  ];
}

export function registerScanCommand(
  program: Command,
  dependencies: ScanCommandDependencies,
): void {
  program
    .command("scan")
    .description("inspect repository discovery metadata")
    .option("--root <path>", "select a repository path")
    .option("--list-roots", "list the selected and nested repository roots")
    .option("--paths", "stream stable repository paths")
    .option("--explain-path <path>", "explain the built-in path decision")
    .option("--include <pattern>", "include a path pattern", collect, [])
    .option("--exclude <pattern>", "exclude a path pattern", collect, [])
    .option("--metadata", "stream normalized file metadata")
    .option("--items", "stream normalized file context items")
    .option("--content", "stream bounded text content")
    .option("--summary", "emit a structured scan summary")
    .action(async (options: ScanOptions) => {
      const selection = resolveScanMode(options);
      if (selection.conflict) {
        dependencies.writeDiagnostic({
          schemaVersion: 1,
          code: "SCAN.MODE_CONFLICT",
          severity: "error",
          source: "scan",
          message: `Scan modes cannot be combined: ${selection.conflict.join(", ")}.`,
        });
        dependencies.setExitCode(EXIT_CODES.validation);
        return;
      }
      const mode = selection.mode;
      const root = resolve(
        dependencies.currentDirectory,
        options.root ?? dependencies.currentDirectory,
      );
      try {
        if (!(await stat(root)).isDirectory())
          throw new Error("Path is not a directory.");
      } catch {
        dependencies.writeDiagnostic({
          schemaVersion: 1,
          code: "SCAN.INVALID_ROOT",
          severity: "error",
          source: "scan",
          message: `Repository root does not exist or is not a directory: ${root}`,
        });
        dependencies.setExitCode(EXIT_CODES.validation);
        return;
      }
      const config = await loadEffectiveConfig({
        repositoryRoot: root,
        environment: {},
      });
      const cliRules = explicitRules(options.include, options.exclude, "CLI");
      const projectRules = explicitRules(
        config.values.include,
        config.values.exclude,
        "project configuration",
      );
      if (mode === "explainPath") {
        const path = normalizeRepositoryRelativePath(options.explainPath!);
        const builtIn = evaluateBuiltInExclusion(path);
        if (builtIn.rule !== null) {
          dependencies.writeData(builtIn);
        } else {
          dependencies.writeData(
            evaluateIgnorePrecedence({
              path,
              isDirectory: false,
              cliRules,
              projectRules,
              fuzitignoreRules: await loadFuzitignoreRulesForPath(root),
              gitignoreRules: await loadGitignoreRulesForPath(root, path),
            }),
          );
        }
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }

      if (mode === "paths") {
        for await (const entry of traverseDirectory(root, {
          cliRules,
          projectRules,
        })) {
          dependencies.writeData(entry.path);
        }
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }

      if (mode === "metadata") {
        for await (const entry of traverseDirectory(root, {
          cliRules,
          projectRules,
        })) {
          if (entry.kind === "directory") continue;
          dependencies.writeData(
            await classifyFile(
              join(root, ...entry.path.split("/")),
              entry.path,
            ),
          );
        }
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }

      if (mode === "items") {
        for await (const entry of traverseDirectory(root, {
          cliRules,
          projectRules,
        })) {
          if (entry.kind !== "file") continue;
          const absolutePath = join(root, ...entry.path.split("/"));
          dependencies.writeData(
            createFileContextItem(
              await classifyFile(absolutePath, entry.path),
              await readTextContent(absolutePath),
            ),
          );
        }
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }

      if (mode === "content") {
        for await (const entry of traverseDirectory(root, {
          cliRules,
          projectRules,
        })) {
          if (entry.kind !== "file") continue;
          dependencies.writeData({
            path: entry.path,
            ...(await readTextContent(join(root, ...entry.path.split("/")))),
          });
        }
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }

      if (mode === "summary") {
        const counts = { files: 0, directories: 0, symlinks: 0 };
        for await (const entry of traverseDirectory(root, {
          cliRules,
          projectRules,
        })) {
          if (entry.kind === "file") counts.files += 1;
          else if (entry.kind === "directory") counts.directories += 1;
          else counts.symlinks += 1;
        }
        dependencies.writeData({
          schemaVersion: 1,
          root,
          counts,
          status: "complete",
          nextSteps: ["fuzit pack --root .", "fuzit graph build --root . --output .fuzit-graph.json"],
        });
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }

      try {
        const resolution = await resolveRepositoryRoots({
          currentDirectory: dependencies.currentDirectory,
          ...(options.root === undefined ? {} : { explicitPath: options.root }),
        });
        dependencies.writeData(canonicalizeRepositoryRootList(resolution));
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        if (error instanceof RepositoryRootError) {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: error.code,
            severity: "error",
            source: "discovery",
            message: error.message,
          });
          dependencies.setExitCode(EXIT_CODES.validation);
          return;
        }
        throw error;
      }
    });
}
