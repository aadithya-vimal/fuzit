import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runIssueContext } from "@fuzit/core";
import {
  parseGitHubUrl,
  parseOwnerRepoHash,
  parseNumericWithRepo,
} from "@fuzit/provider-github";
import { inferRemoteFromGitConfig } from "@fuzit/git";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

export function registerIssueCommand(
  program: Command,
  dependencies: {
    readonly currentDirectory: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
    readonly setExitCode: (code: ExitCode) => void;
  },
): void {
  program
    .command("issue")
    .description("get context from a GitHub issue")
    .argument("<source>", "Issue URL, OWNER/REPO#NUMBER, or ISSUE-NUMBER")
    .option("--repo <repo>", "target repository in OWNER/REPO format")
    .option("--profile <profile>", "profile", "default")
    .option("--output <path>", "output path or '-' for stdout", "-")
    .action(
      async (
        sourceArg: string,
        options: {
          repo?: string;
          profile: string;
          output: string;
        },
      ) => {
        try {
          let issueRef;
          if (
            sourceArg.startsWith("http://") ||
            sourceArg.startsWith("https://")
          ) {
            const parsed = parseGitHubUrl(sourceArg);
            if (!parsed.ok || parsed.ref.kind !== "github-issue") {
              throw new Error(`invalid issue URL '${sourceArg}'`);
            }
            issueRef = parsed.ref;
          } else if (sourceArg.includes("#")) {
            const parsed = parseOwnerRepoHash(sourceArg, "issue");
            if (!parsed.ok) throw new Error(parsed.reason);
            issueRef = parsed.ref;
          } else if (/^\d+$/.test(sourceArg)) {
            if (options.repo) {
              const parsed = parseNumericWithRepo(
                sourceArg,
                options.repo,
                "issue",
              );
              if (!parsed.ok) throw new Error(parsed.reason);
              issueRef = parsed.ref;
            } else {
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
                "issue",
              );
              if (!parsed.ok) throw new Error(parsed.reason);
              issueRef = parsed.ref;
            }
          } else {
            throw new Error(`invalid issue argument '${sourceArg}'`);
          }

          const result = await runIssueContext({
            issueRef,
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
