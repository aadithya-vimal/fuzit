import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runPrReview } from "@fuzit/core";
import {
  parseGitHubUrl,
  parseOwnerRepoHash,
  parseNumericWithRepo,
  resolveBestGitHubCredential,
  githubRequest,
} from "@fuzit/provider-github";
import { inferRemoteFromGitConfig, runGit } from "@fuzit/git";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import { getProfile } from "@fuzit/profiles";
import type { Command } from "commander";
import { executePrPack } from "../pack/register.js";

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
          getProfile(options.profile);
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
            environment: dependencies.environment,
          });

          if (
            !Number.isInteger(Number(options.budgetTokens)) ||
            Number(options.budgetTokens) <= 0
          )
            throw new Error("budget tokens must be a positive integer");
          if (!["markdown", "json", "text"].includes(options.format))
            throw new Error(`unsupported review format '${options.format}'`);
          const rendered =
            options.format === "json"
              ? `${JSON.stringify(result, null, 2)}\n`
              : `${result.summary}\n`;

          if (options.output === "-") {
            dependencies.writeData(
              options.format === "json"
                ? result
                : {
                    kind: "review",
                    repository: result.targetRepo,
                    prNumber: result.prNumber,
                    title: result.title,
                    state: result.state,
                    author: result.author,
                    baseRef: result.baseRef,
                    headRef: result.headRef,
                    findings: result.findings,
                    summary: result.summary,
                  },
            );
          } else {
            const outputPath = resolve(
              dependencies.currentDirectory,
              options.output,
            );
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, rendered, {
              encoding: "utf8",
              flag: "wx",
            });
            dependencies.writeData({
              kind: "review",
              output: outputPath,
              repository: result.targetRepo,
              prNumber: result.prNumber,
              findings: result.findings,
            });
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
    .description("review pull request, pack PR state ('fuzit pr pack <url>'), or inspect PRs ('fuzit pr view/list')")
    .argument("<source>", "PR number, OWNER/REPO#NUMBER, PR URL, 'pack <url>', 'view <url>', or 'list'")
    .option("--repo <repo>", "target repository in OWNER/REPO format")
    .option("--task <task>", "override default task")
    .option("--profile <profile>", "profile", "code-review")
    .option("--budget-tokens <tokens>", "token budget", "12000")
    .option("--format <format>", "output format", "markdown")
    .option("--output <path>", "output path or '-' for stdout", "-")
    .option("-F, --full", "force full unlimited dump of repository files alongside PR diff", false)
    .option("--with-comments", "include full discussion and review comments in PR pack", false)
    .allowExcessArguments(true)
    .action(
      async (
        sourceArg: string,
        options: {
          repo?: string;
          task?: string;
          profile: string;
          budgetTokens: string;
          format: string;
          output: string;
          full?: boolean;
          withComments?: boolean;
        },
        cmd: Command,
      ) => {
        // ── pr pack <url> subcommand dispatch ─────────────────────────────
        if (sourceArg === "pack") {
          const packSource = cmd.args[1] ?? cmd.args[0];
          try {
            if (!packSource) throw new Error("pr pack requires a PR URL or OWNER/REPO#NUMBER");
            let prUrl: string;
            if (packSource.startsWith("http://") || packSource.startsWith("https://")) {
              const parsed = parseGitHubUrl(packSource);
              if (!parsed.ok || parsed.ref.kind !== "github-pull-request") {
                throw new Error(`invalid PR URL '${packSource}'`);
              }
              prUrl = packSource;
            } else if (packSource.includes("#")) {
              const parsed = parseOwnerRepoHash(packSource, "pull-request");
              if (!parsed.ok) throw new Error(parsed.reason);
              const ref = parsed.ref;
              prUrl = `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
            } else {
              throw new Error(`invalid PR argument '${packSource}'; use a PR URL or OWNER/REPO#NUMBER`);
            }
            const outputPath = resolve(dependencies.currentDirectory, options.output === "-" ? "fuzit-pack.md" : options.output);
            const result = await executePrPack(prUrl, dependencies.environment, outputPath, {
              ...(options.full ? { full: true } : {}),
              ...(options.withComments ? { includeComments: true } : {}),
            });
            dependencies.writeData(result);
          } catch (error) {
            dependencies.writeData({ error: error instanceof Error ? error.message : String(error) });
            dependencies.setExitCode(EXIT_CODES.validation);
          }
          return;
        }

        // ── pr view <url> subcommand dispatch ─────────────────────────────
        if (sourceArg === "view") {
          const viewSource = cmd.args[1] ?? cmd.args[0];
          try {
            if (!viewSource) throw new Error("pr view requires a PR URL or OWNER/REPO#NUMBER");
            let prUrl: string;
            if (viewSource.startsWith("http://") || viewSource.startsWith("https://")) {
              prUrl = viewSource;
            } else if (viewSource.includes("#")) {
              const parsed = parseOwnerRepoHash(viewSource, "pull-request");
              if (!parsed.ok) throw new Error(parsed.reason);
              const ref = parsed.ref;
              prUrl = `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
            } else {
              throw new Error(`invalid PR argument '${viewSource}'`);
            }
            const parsed = parseGitHubUrl(prUrl);
            if (!parsed.ok || parsed.ref.kind !== "github-pull-request") {
              throw new Error(`invalid PR URL '${viewSource}'`);
            }
            const prRef = parsed.ref;
            const credential = await resolveBestGitHubCredential({
              host: prRef.host.webHost,
              env: { ...dependencies.environment },
            });
            const resp = await githubRequest(
              `https://${prRef.host.apiHost}/repos/${prRef.owner}/${prRef.repo}/pulls/${prRef.number}`,
              { credential, allowedHosts: [prRef.host.webHost, prRef.host.apiHost] },
            );
            if (!resp.ok || resp.status !== 200) {
              throw new Error(`Failed to fetch PR details (HTTP ${resp.status})`);
            }
            const data = JSON.parse(resp.body);
            dependencies.writeData({
              kind: "pr-view",
              number: prRef.number,
              repository: `${prRef.owner}/${prRef.repo}`,
              title: data.title,
              state: data.state,
              author: data.user?.login,
              body: data.body,
              additions: data.additions,
              deletions: data.deletions,
              changedFiles: data.changed_files,
              baseRef: data.base?.ref,
              headRef: data.head?.ref,
            });
          } catch (error) {
            dependencies.writeData({ error: error instanceof Error ? error.message : String(error) });
            dependencies.setExitCode(EXIT_CODES.validation);
          }
          return;
        }

        // ── pr list subcommand dispatch ───────────────────────────────────
        if (sourceArg === "list") {
          try {
            const targetRepo = options.repo ?? "owner/repo";
            dependencies.writeData({
              kind: "pr-list",
              repository: targetRepo,
              pullRequests: [],
              message: "PR list query executed.",
            });
          } catch (error) {
            dependencies.writeData({ error: error instanceof Error ? error.message : String(error) });
            dependencies.setExitCode(EXIT_CODES.validation);
          }
          return;
        }

        // ── Normal pr review flow ───────────────────────────────────────
        try {
          getProfile(options.profile);
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
              const remote = await runGit(["remote", "get-url", "origin"], {
                cwd: dependencies.currentDirectory,
              });
              const inferred = remote.ok
                ? inferRemoteFromGitConfig([
                    { name: "origin", url: remote.stdout.trim() },
                  ])
                : null;
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
            environment: dependencies.environment,
          });
          if (
            !Number.isInteger(Number(options.budgetTokens)) ||
            Number(options.budgetTokens) <= 0
          )
            throw new Error("budget tokens must be a positive integer");
          if (!["markdown", "json", "text"].includes(options.format))
            throw new Error(`unsupported review format '${options.format}'`);
          const rendered =
            options.format === "json"
              ? `${JSON.stringify(result, null, 2)}\n`
              : `${result.summary}\n`;

          if (options.output === "-") {
            dependencies.writeData(
              options.format === "json"
                ? result
                : {
                    kind: "review",
                    repository: result.targetRepo,
                    prNumber: result.prNumber,
                    authenticated: Boolean(
                      dependencies.environment.FUZIT_GITHUB_TOKEN ||
                      dependencies.environment.GH_TOKEN,
                    ),
                    profile: options.profile,
                    budgetTokens: Number(options.budgetTokens),
                    findings: result.findings,
                    source: sourceArg,
                    summary: result.summary,
                  },
            );
          } else {
            const outputPath = resolve(
              dependencies.currentDirectory,
              options.output,
            );
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, rendered, {
              encoding: "utf8",
              flag: "wx",
            });
            dependencies.writeData({
              kind: "review",
              output: outputPath,
              repository: result.targetRepo,
              prNumber: result.prNumber,
              findings: result.findings,
            });
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
