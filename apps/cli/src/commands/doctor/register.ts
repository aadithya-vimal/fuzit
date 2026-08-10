import { loadEffectiveConfig } from "@fuzit/config";
import { runDoctor, type DoctorReport } from "@fuzit/core";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

interface DoctorCommandDependencies {
  readonly workingDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly json: boolean;
  readonly writeData: (value: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = report.checks.map((check) => {
    const label =
      check.status === "pass"
        ? "PASS"
        : check.status === "warning"
          ? "WARN"
          : "FAIL";
    return `${label} ${check.id}: ${check.message}`;
  });

  return ["Fuzit doctor", ...lines].join("\n");
}

export function registerDoctorCommand(
  program: Command,
  dependencies: DoctorCommandDependencies,
): void {
  program
    .command("doctor")
    .description("report local environment readiness")
    .action(async () => {
      const report = await runDoctor(dependencies.workingDirectory, {
        ...(dependencies.environment.npm_config_user_agent === undefined
          ? {}
          : {
              pnpmUserAgent: dependencies.environment.npm_config_user_agent,
            }),
        checkConfiguration: async () => {
          await loadEffectiveConfig({
            repositoryRoot: dependencies.workingDirectory,
            environment: dependencies.environment,
          });
        },
      });

      dependencies.writeData(
        dependencies.json ? report : formatDoctorReport(report),
      );
      dependencies.setExitCode(
        report.status === "ready" ? EXIT_CODES.success : EXIT_CODES.environment,
      );
    });
}
