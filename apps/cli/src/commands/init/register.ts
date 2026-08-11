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
    .option("--mcp", "initialize Model Context Protocol server config and Agent Skills", false)
    .action(async (options: { dryRun: boolean; force: boolean; mcp?: boolean }) => {
      try {
        const input = {
          repositoryRoot: dependencies.repositoryRoot,
          force: options.force,
        };
        let plan = await planInitialization(input);

        if (options.mcp) {
          const mcpConfigContent = JSON.stringify(
            {
              mcpServers: {
                fuzit: {
                  command: "fuzit",
                  args: ["plugin", "mcp"],
                  env: { FUZIT_CACHE_HOME: ".cache" },
                },
              },
            },
            null,
            2,
          );
          const skillContent = `---
name: fuzit-pack
description: Build task-aware security-filtered context bundle for AI coding workflows.
---
# Fuzit Context Pack Skill

Use \`fuzit pack --root .\` to bundle repository context with automatic security redaction and intelligence graph ranking.
`;
          const mcpPlan = {
            ...plan,
            changes: [
              ...plan.changes,
              { action: "CREATE", path: ".vscode/mcp.json", content: mcpConfigContent },
              { action: "CREATE", path: ".agents/skills/fuzit-pack/SKILL.md", content: skillContent },
            ],
          };

          dependencies.writeData(
            dependencies.json
              ? { ...mcpPlan, dryRun: options.dryRun, applied: !options.dryRun }
              : formatInitPlan(mcpPlan as any, options.dryRun),
          );
          dependencies.setExitCode(EXIT_CODES.success);
          return;
        }

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
