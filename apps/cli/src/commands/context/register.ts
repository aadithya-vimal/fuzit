import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createTaskContext, renderTaskContext } from "@fuzit/core";
import {
  createRepositoryId,
  getLocalIndexPath,
  inspectLocalIndex,
} from "@fuzit/index";
import { getProfile } from "@fuzit/profiles";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

import {
  acquireRepository,
  repositoryIdentity,
} from "../../application/repository.js";

export function registerContextCommand(
  program: Command,
  dependencies: {
    readonly currentDirectory: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
    readonly setExitCode: (code: ExitCode) => void;
  },
): void {
  program
    .command("context")
    .description("build task-aware local context")
    .requiredOption("--task <task>")
    .requiredOption("--profile <profile>")
    .requiredOption("--budget-tokens <tokens>")
    .requiredOption("--format <format>")
    .requiredOption("--output <path>")
    .option("--root <path>")
    .option("--no-index")
    .option("--explain", "emit aligned selection evidence")
    .action(
      async (options: {
        task: string;
        profile: string;
        budgetTokens: string;
        format: string;
        output: string;
        root?: string;
        index: boolean;
        explain?: boolean;
      }) => {
        try {
          const profile = getProfile(options.profile);
          if (!["markdown", "json", "text", "xml"].includes(options.format))
            throw new Error("unsupported format");
          const root = resolve(
            dependencies.currentDirectory,
            options.root ?? ".",
          );
          const acquisition = await acquireRepository(
            root,
            dependencies.environment,
          );
          let index: "used" | "bypassed" | "unavailable" = options.index
            ? "unavailable"
            : "bypassed";
          if (options.index) {
            const identity = await repositoryIdentity(root);
            const cacheHome =
              dependencies.environment.FUZIT_CACHE_HOME ??
              resolve(dependencies.environment.LOCALAPPDATA ?? ".cache");
            const indexPath = getLocalIndexPath({
              cacheHome,
              repositoryFingerprint: identity.fingerprint,
            });
            const status = await inspectLocalIndex(
              indexPath,
              createRepositoryId(identity.fingerprint),
            );
            if (status.kind === "ready") {
              index = "used";
            } else {
              index = "unavailable";
            }
          }
          const result = await createTaskContext({
            items: acquisition.items,
            task: options.task,
            profile,
            budgetTokens: Number.parseInt(options.budgetTokens, 10),
            ...(options.explain === undefined
              ? {}
              : { explain: options.explain }),
            index,
            omissions: options.explain
              ? acquisition.omissions.map(({ path, reason }) => ({
                  path,
                  reason,
                }))
              : [],
          });
          const rendered = renderTaskContext(
            result,
            options.format as "markdown" | "json" | "text" | "xml",
          );
          if (options.output === "-") dependencies.writeData(rendered);
          else {
            const output = resolve(
              dependencies.currentDirectory,
              options.output,
            );
            await mkdir(dirname(output), { recursive: true });
            await writeFile(output, rendered, { encoding: "utf8", flag: "wx" });
            dependencies.writeData({
              output,
              selected: result.selected.map(({ path }) => path),
              report: result,
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
