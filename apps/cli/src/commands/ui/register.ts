import { resolve } from "node:path";
import { BUILT_IN_PROFILES } from "@fuzit/profiles";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";
import { acquireRepository, analyzeRepository } from "../../application/repository.js";

interface UiDependencies {
  readonly currentDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly setExitCode: (code: ExitCode) => void;
}

export function registerUiCommand(
  program: Command,
  dependencies: UiDependencies,
): void {
  program
    .command("ui")
    .alias("interactive")
    .description("Interactive CLI dashboard and context bundle inspector")
    .option("--root <path>", "Repository root path", ".")
    .action(async (options: { root: string }) => {
      try {
        const root = resolve(dependencies.currentDirectory, options.root);
        const acquisition = await acquireRepository(root, dependencies.environment);
        const intelligence = analyzeRepository(acquisition);

        dependencies.writeData({
          kind: "ui-dashboard",
          repository: root,
          totalFiles: acquisition.items.length,
          omissions: acquisition.omissions.length,
          languages: intelligence.languages,
          packages: intelligence.packages,
          frameworks: intelligence.frameworks,
          profilesCount: BUILT_IN_PROFILES.length,
        });
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        dependencies.writeData({
          error: error instanceof Error ? error.message : String(error),
        });
        dependencies.setExitCode(EXIT_CODES.internal);
      }
    });
}
