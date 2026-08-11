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
import { join, resolve } from "node:path";

interface ScanCommandDependencies {
  readonly currentDirectory: string;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
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
    .action(
      async (options: {
        explainPath?: string;
        root?: string;
        listRoots?: boolean;
        paths?: boolean;
        include: string[];
        exclude: string[];
        metadata?: boolean;
        items?: boolean;
        content?: boolean;
        summary?: boolean;
      }) => {
        const root = resolve(
          dependencies.currentDirectory,
          options.root ?? dependencies.currentDirectory,
        );
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
        if (options.explainPath !== undefined) {
          const path = normalizeRepositoryRelativePath(options.explainPath);
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

        if (options.paths) {
          for await (const entry of traverseDirectory(root, {
            cliRules,
            projectRules,
          })) {
            dependencies.writeData(entry.path);
          }
          dependencies.setExitCode(EXIT_CODES.success);
          return;
        }

        if (options.metadata) {
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

        if (options.items) {
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

        if (options.content) {
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

        if (options.summary || !options.listRoots) {
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
          });
          dependencies.setExitCode(EXIT_CODES.success);
          return;
        }

        try {
          const resolution = await resolveRepositoryRoots({
            currentDirectory: dependencies.currentDirectory,
            ...(options.root === undefined
              ? {}
              : { explicitPath: options.root }),
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
      },
    );
}
