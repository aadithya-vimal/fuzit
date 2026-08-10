import {
  InitConflictError,
  applyInitialization,
  planInitialization,
  type InitPlan,
} from "@fuzit/config";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

interface InitCommandDependencies {
  readonly repositoryRoot: string;
  readonly json: boolean;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

function formatInitPlan(plan: InitPlan, dryRun: boolean): string {
  if (plan.changes.length === 0) {
    return "Fuzit init\nNo changes.";
  }

  const lines = [dryRun ? "Fuzit init dry run" : "Fuzit init applied"];
  for (const change of plan.changes) {
    lines.push(`${change.action.toUpperCase()} ${change.path}`);
    if (change.content !== undefined) {
      lines.push(
        ...change.content
          .trimEnd()
          .split("\n")
          .map((line) => `  ${line}`),
      );
    }
    if (change.lines !== undefined) {
      lines.push(...change.lines.map((line) => `  ${line}`));
    }
  }
  return lines.join("\n");
}

export function registerInitCommand(
  program: Command,
  dependencies: InitCommandDependencies,
): void {
  program
    .command("init")
    .description("initialize approved local Fuzit files")
    .option("--dry-run", "show exact changes without writing files", false)
    .option("--force", "replace an incompatible existing configuration", false)
    .action(async (options: { dryRun: boolean; force: boolean }) => {
      try {
        const input = {
          repositoryRoot: dependencies.repositoryRoot,
          force: options.force,
        };
        const plan = await planInitialization(input);

        if (!options.dryRun) {
          await applyInitialization(input, plan);
        }

        dependencies.writeData(
          dependencies.json
            ? {
                ...plan,
                dryRun: options.dryRun,
                applied: !options.dryRun && plan.changes.length > 0,
              }
            : formatInitPlan(plan, options.dryRun),
        );
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        if (error instanceof InitConflictError) {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: error.code,
            severity: "error",
            source: "init",
            message: error.message,
          });
          dependencies.setExitCode(EXIT_CODES.validation);
          return;
        }
        throw error;
      }
    });
}
