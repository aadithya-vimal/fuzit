import {
  ConfigLoadError,
  loadEffectiveConfig,
  type ConfigOverrides,
} from "@fuzit/config";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

interface ConfigCommandDependencies {
  readonly repositoryRoot: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

function configDiagnostic(error: ConfigLoadError): Diagnostic {
  const details =
    error.issues.length === 0 ? "" : ` ${error.issues.join("; ")}`;

  return {
    schemaVersion: 1,
    code: error.code,
    severity: "error",
    source: "config",
    message: `${error.message}${details}`,
  };
}

function positiveInteger(value: string): number {
  return Number(value);
}

export function registerConfigCommand(
  program: Command,
  dependencies: ConfigCommandDependencies,
): void {
  const config = program
    .command("config")
    .description("inspect effective configuration")
    .action(async () => {
      try {
        const effectiveConfig = await loadEffectiveConfig({
          repositoryRoot: dependencies.repositoryRoot,
          environment: dependencies.environment,
          cli: {},
        });
        dependencies.writeData(effectiveConfig);
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        if (error instanceof ConfigLoadError) {
          dependencies.writeDiagnostic(configDiagnostic(error), error);
          dependencies.setExitCode(EXIT_CODES.validation);
          return;
        }
        throw error;
      }
    });

  config
    .command("show")
    .description("show effective configuration and provenance")
    .option("--output-format <format>", "override the output format")
    .option(
      "--max-files <count>",
      "override the maximum file count",
      positiveInteger,
    )
    .option("--diagnostic-level <level>", "override the diagnostic level")
    .action(
      async (options: {
        outputFormat?: string;
        maxFiles?: number;
        diagnosticLevel?: string;
      }) => {
        const cli: ConfigOverrides = {
          ...(options.outputFormat === undefined
            ? {}
            : { outputFormat: options.outputFormat }),
          ...(options.maxFiles === undefined
            ? {}
            : { maxFiles: options.maxFiles }),
          ...(options.diagnosticLevel === undefined
            ? {}
            : { diagnosticLevel: options.diagnosticLevel }),
        };

        try {
          const effectiveConfig = await loadEffectiveConfig({
            repositoryRoot: dependencies.repositoryRoot,
            environment: dependencies.environment,
            cli,
          });
          dependencies.writeData(effectiveConfig);
          dependencies.setExitCode(EXIT_CODES.success);
        } catch (error) {
          if (error instanceof ConfigLoadError) {
            dependencies.writeDiagnostic(configDiagnostic(error), error);
            dependencies.setExitCode(EXIT_CODES.validation);
            return;
          }

          throw error;
        }
      },
    );
}
