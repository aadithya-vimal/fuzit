import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  explainPath,
  formatSelectionExplanation,
  renderSelectionFailure,
  type SelectionReport,
} from "@fuzit/selection";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

async function loadReport(path: string): Promise<SelectionReport> {
  const value: unknown = JSON.parse(await readFile(resolve(path), "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    !("entries" in value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.entries)
  ) {
    throw new Error("Selection report schema is invalid.");
  }
  return value as SelectionReport;
}

export function registerExplainCommand(
  program: Command,
  dependencies: {
    readonly json: boolean;
    readonly writeData: (value: unknown) => void;
    readonly setExitCode: (code: ExitCode) => void;
  },
): void {
  const explain = program
    .command("explain")
    .description("explain selection evidence");
  explain
    .command("selection <report>")
    .description("explain every selection decision")
    .action(async (reportPath: string) => {
      try {
        const report = await loadReport(reportPath);
        dependencies.writeData(
          dependencies.json
            ? report
            : report.entries.map(formatSelectionExplanation).join("\n\n"),
        );
      } catch (error) {
        dependencies.writeData(
          renderSelectionFailure(error, dependencies.json ? "json" : "text"),
        );
        dependencies.setExitCode(EXIT_CODES.validation);
      }
    });
  explain
    .command("path <path> <report>")
    .description("explain one path")
    .action(async (path: string, reportPath: string) => {
      try {
        const evidence = explainPath(await loadReport(reportPath), path);
        dependencies.writeData(
          dependencies.json ? evidence : formatSelectionExplanation(evidence),
        );
      } catch (error) {
        dependencies.writeData(
          renderSelectionFailure(error, dependencies.json ? "json" : "text"),
        );
        dependencies.setExitCode(EXIT_CODES.validation);
      }
    });
}
