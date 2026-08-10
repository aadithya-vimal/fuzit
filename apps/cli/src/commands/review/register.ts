import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runPrReview } from "@fuzit/core";
import {
  parseGitHubUrl,
  parseOwnerRepoHash,
  parseNumericWithRepo,
} from "@fuzit/provider-github";
import { inferRemoteFromGitConfig } from "@fuzit/git";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

export function registerReviewCommand(
  program: Command,
  dependencies: {
    readonly currentDirectory: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
    readonly setExitCode: (code: ExitCode) => void;
  },
): void {
  program
    .command("review")
    .description("review a GitHub pull request")
    .argument("<source>", "PR URL or OWNER/REPO#NUMBER")
    .option("--task <task>", "override default code-review task")
    .option("--profile <profile>", "profile to use", "code-review")
    .option("--budget-tokens <tokens>", "token budget", "12000")
    .option("--format <format>", "output format", "markdown")
    .option("--output <path>", "output path or '-' for stdout", "-")
    .action(
      async (
        sourceArg: string,
        options: {
          task?: string;
          profile: string;
          budgetTokens: string;
          format: string;
          output: string;
        },
      ) => {
        try {
          let prRef;
          if (
            sourceArg.startsWith("http://") ||
            sourceArg.startsWith("https://")
          ) {
            const parsed = parseGitHubUrl(sourceArg);
            if (!parsed.ok || parsed.ref.kind !== "github-pull-request") {
              throw new Error(
                `invalid PR URL '${sourceArg}': ${parsed.ok ? "not a PR URL" : parsed.reason}`,
              );
            }
            prRef = parsed.ref;
          } else {
            const parsed = parseOwnerRepoHash(sourceArg, "pull-request");
            if (!parsed.ok) {
              throw new Error(
                `invalid PR reference '${sourceArg}': ${parsed.reason}`,
              );
            }
            prRef = parsed.ref;
          }

          const result = await runPrReview({
            prRef,
            ...(options.task ? { task: options.task } : {}),
            profileName: options.profile,
          });

          if (options.output === "-") {
            dependencies.writeData(result.summary);
          } else {
            const outputPath = resolve(
              dependencies.currentDirectory,
              options.output,
            );
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, result.summary, "utf8");
            dependencies.writeData({ output: outputPath, result });
          }
        } catch (error) {
          dependencies.writeData({
            error: error instanceof Error ? error.message : String(error),
          });
          dependencies.setExitCode(EXIT_CODES.validation);
        }
      },
    );
}

export function registerPrCommand(
  program: Command,
  dependencies: {
    readonly currentDirectory: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
    readonly setExitCode: (code: ExitCode) => void;
  },
): void {
  program
    .command("pr")
    .description("review pull request shorthand")
    .argument("<source>", "PR number, OWNER/REPO#NUMBER, or PR URL")
    .option("--repo <repo>", "target repository in OWNER/REPO format")
    .option("--task <task>", "override default task")
    .option("--profile <profile>", "profile", "code-review")
    .option("--output <path>", "output path or '-' for stdout", "-")
    .action(
      async (
        sourceArg: string,
        options: {
          repo?: string;
          task?: string;
          profile: string;
          output: string;
        },
      ) => {
        try {
          let prRef;
          if (
            sourceArg.startsWith("http://") ||
            sourceArg.startsWith("https://")
          ) {
            const parsed = parseGitHubUrl(sourceArg);
            if (!parsed.ok || parsed.ref.kind !== "github-pull-request") {
              throw new Error(`invalid PR URL '${sourceArg}'`);
            }
            prRef = parsed.ref;
          } else if (sourceArg.includes("#")) {
            const parsed = parseOwnerRepoHash(sourceArg, "pull-request");
            if (!parsed.ok) throw new Error(parsed.reason);
            prRef = parsed.ref;
          } else if (/^\d+$/.test(sourceArg)) {
            if (options.repo) {
              const parsed = parseNumericWithRepo(
                sourceArg,
                options.repo,
                "pull-request",
              );
              if (!parsed.ok) throw new Error(parsed.reason);
              prRef = parsed.ref;
            } else {
              // infer from local clone remotes
              const inferred = inferRemoteFromGitConfig([
                { name: "origin", url: "https://github.com/inferred/repo.git" },
              ]);
              if (!inferred)
                throw new Error(
                  "Could not infer repository from local clone; pass --repo OWNER/REPO",
                );
              const parsed = parseNumericWithRepo(
                sourceArg,
                `${inferred.owner}/${inferred.repo}`,
                "pull-request",
              );
              if (!parsed.ok) throw new Error(parsed.reason);
              prRef = parsed.ref;
            }
          } else {
            throw new Error(`invalid PR argument '${sourceArg}'`);
          }

          const result = await runPrReview({
            prRef,
            ...(options.task ? { task: options.task } : {}),
            profileName: options.profile,
          });

          if (options.output === "-") {
            dependencies.writeData(result.summary);
          } else {
            const outputPath = resolve(
              dependencies.currentDirectory,
              options.output,
            );
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, result.summary, "utf8");
            dependencies.writeData({ output: outputPath, result });
          }
        } catch (error) {
          dependencies.writeData({
            error: error instanceof Error ? error.message : String(error),
          });
          dependencies.setExitCode(EXIT_CODES.validation);
        }
      },
    );
}
