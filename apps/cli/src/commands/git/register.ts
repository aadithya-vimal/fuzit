import {
  collectGitDiff,
  collectGitHistory,
  collectGitStatus,
  collectBlame,
  collectFileHistory,
} from "@fuzit/git";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

interface GitCommandDependencies {
  readonly currentDirectory: string;
  readonly writeData: (value: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

export function registerGitCommand(
  program: Command,
  dependencies: GitCommandDependencies,
): void {
  const git = program.command("git").description("inspect local Git context");
  git
    .command("status")
    .description("show normalized working changes")
    .action(async () => {
      dependencies.writeData({
        schemaVersion: 1,
        changes: await collectGitStatus(dependencies.currentDirectory),
      });
      dependencies.setExitCode(EXIT_CODES.success);
    });
  git
    .command("log")
    .description("show bounded local commit history")
    .option("--limit <count>", "maximum commits", "20")
    .action(async (options: { limit: string }) => {
      const limit = Number.parseInt(options.limit, 10);
      dependencies.writeData({
        schemaVersion: 1,
        entries: await collectGitHistory(dependencies.currentDirectory, {
          limit: Number.isFinite(limit) ? limit : 20,
        }),
      });
      dependencies.setExitCode(EXIT_CODES.success);
    });
  git
    .command("diff")
    .description("show bounded redacted local diff")
    .option("--base <revision>", "explicit base revision")
    .action(async (options: { base?: string }) => {
      dependencies.writeData({
        schemaVersion: 1,
        ...(await collectGitDiff(dependencies.currentDirectory, options)),
      });
      dependencies.setExitCode(EXIT_CODES.success);
    });
  git
    .command("file-history")
    .argument("<path>")
    .option("--limit <count>", "maximum commits", "20")
    .action(async (path: string, options: { limit: string }) => {
      dependencies.writeData({
        schemaVersion: 1,
        entries: await collectFileHistory(
          dependencies.currentDirectory,
          path,
          Number.parseInt(options.limit, 10),
        ),
      });
      dependencies.setExitCode(EXIT_CODES.success);
    });
  git
    .command("blame")
    .argument("<path>")
    .requiredOption("--lines <range>", "inclusive start:end")
    .action(async (path: string, options: { lines: string }) => {
      dependencies.writeData({
        schemaVersion: 1,
        lines: await collectBlame(
          dependencies.currentDirectory,
          path,
          options.lines,
        ),
      });
      dependencies.setExitCode(EXIT_CODES.success);
    });
}
