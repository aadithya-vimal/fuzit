import type { Command } from "commander";
import { resolve } from "node:path";
import { acquireRepository } from "../../application/repository.js";
import { computeStats } from "../pack/register.js";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";

export function registerStatsCommand(
  program: Command,
  dependencies: {
    readonly currentDirectory: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
    readonly setExitCode: (code: ExitCode) => void;
  },
): void {
  program
    .command("stats [root]")
    .description("inspect repository token & file distribution statistics")
    .option("-F, --full", "inspect full repository without file truncation", false)
    .action(async (rootArg: string | undefined, options: { full?: boolean }) => {
      try {
        const root = resolve(dependencies.currentDirectory, rootArg ?? ".");
        const acquisition = await acquireRepository(
          root,
          dependencies.environment,
          options.full ? { full: true } : {},
        );
        const stats = computeStats(acquisition.items);
        dependencies.writeData({
          kind: "stats",
          repository: root,
          ...stats,
        });
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        dependencies.writeData({ error: error instanceof Error ? error.message : String(error) });
        dependencies.setExitCode(EXIT_CODES.validation);
      }
    });
}
