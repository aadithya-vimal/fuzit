import { readFileSync } from "node:fs";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import { Command, CommanderError, Option } from "commander";

import { registerConfigCommand } from "./config/register.js";
import { registerDoctorCommand } from "./commands/doctor/register.js";
import { registerInitCommand } from "./commands/init/register.js";
import { registerScanCommand } from "./commands/scan/register.js";
import { registerPackCommand } from "./commands/pack/register.js";
import { registerGitCommand } from "./commands/git/register.js";
import { registerCacheCommand } from "./commands/cache/register.js";
import { registerSnapshotCommand } from "./commands/snapshot/register.js";
import { registerDiffCommand } from "./commands/diff/register.js";
import { registerProfileCommand } from "./commands/profile/register.js";
import { registerContextCommand } from "./commands/context/register.js";
import { registerExplainCommand } from "./commands/explain/register.js";
import { registerWatchCommand } from "./commands/watch/register.js";
import { registerGraphCommand } from "./commands/graph/register.js";
import {
  registerReviewCommand,
  registerPrCommand,
} from "./commands/review/register.js";
import { registerIssueCommand } from "./commands/issue/register.js";
import { registerPluginCommand } from "./commands/plugin/register.js";
import { registerSupportCommand } from "./commands/support/register.js";
import { routeSourceInput } from "@fuzit/core";
import { createOutputRouter, type OutputIo } from "./output/router.js";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version?: unknown };

if (typeof packageMetadata.version !== "string") {
  throw new Error("CLI package version is missing");
}

export const CLI_VERSION = packageMetadata.version;
export const CLI_USAGE_ERROR_EXIT_CODE = EXIT_CODES.validation;

function createProgram(io: OutputIo): Command {
  return new Command()
    .name("fuzit")
    .description("Private, local-first AI context-engineering CLI.")
    .version(CLI_VERSION)
    .addOption(
      new Option("--json", "emit machine-readable JSON output").default(false),
    )
    .addOption(
      new Option("--quiet", "suppress nonessential output")
        .default(false)
        .conflicts("debug"),
    )
    .addOption(
      new Option("--debug", "enable debug diagnostics")
        .default(false)
        .conflicts("quiet"),
    )
    .allowExcessArguments(true)
    .showSuggestionAfterError(false)
    .showHelpAfterError(false)
    .exitOverride()
    .configureOutput({
      writeOut: io.writeOut,
      writeErr: io.writeErr,
      outputError: () => {},
    })
    .addHelpText(
      "after",
      `\nUnknown commands exit with status ${EXIT_CODES.validation}.`,
    );
}

function cliDiagnostic(
  code: "CLI.INTERNAL" | "CLI.INVALID_ARGUMENT" | "CLI.UNKNOWN_COMMAND",
  message: string,
): Diagnostic {
  return {
    schemaVersion: 1,
    code,
    severity: "error",
    source: "cli",
    message,
  };
}

export async function runCli(
  arguments_: readonly string[],
  io: OutputIo,
  runtime: {
    readonly repositoryRoot?: string;
    readonly environment?: Readonly<Record<string, string | undefined>>;
  } = {},
): Promise<ExitCode> {
  const jsonRequested = arguments_.includes("--json");
  const output = createOutputRouter(io, {
    debug: arguments_.includes("--debug"),
    json: jsonRequested,
    quiet: arguments_.includes("--quiet"),
  });

  if (arguments_.includes("--quiet") && arguments_.includes("--debug")) {
    output.writeDiagnostic(
      cliDiagnostic(
        "CLI.INVALID_ARGUMENT",
        "option '--quiet' cannot be used with option '--debug'",
      ),
    );
    return EXIT_CODES.validation;
  }

  const program = createProgram(io);
  let commandExitCode: ExitCode = EXIT_CODES.success;

  registerConfigCommand(program, {
    repositoryRoot: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerDoctorCommand(program, {
    workingDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    json: jsonRequested,
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerInitCommand(program, {
    repositoryRoot: runtime.repositoryRoot ?? process.cwd(),
    json: jsonRequested,
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerScanCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerPackCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerGitCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerCacheCommand(program, {
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
  });
  registerSnapshotCommand(program, {
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
  });
  registerDiffCommand(program, {
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
  });
  registerProfileCommand(program, output.writeData);
  registerContextCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerExplainCommand(program, {
    json: jsonRequested,
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerWatchCommand(program, {
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerGraphCommand(program, {
    repositoryRoot: runtime.repositoryRoot ?? process.cwd(),
    json: jsonRequested,
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerReviewCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerPrCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerIssueCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerPluginCommand(program, {
    workingDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    json: jsonRequested,
    writeData: output.writeData,
    writeDiagnostic: output.writeDiagnostic,
    setExitCode: (exitCode) => {
      commandExitCode = exitCode;
    },
  });
  registerSupportCommand(program, CLI_VERSION, output.writeData);

  // Top-level URL dispatch handling (e.g. `fuzit https://github.com/...`)
  const firstArg = arguments_[0];
  if (
    firstArg &&
    (firstArg.startsWith("http://") || firstArg.startsWith("https://"))
  ) {
    const route = routeSourceInput(firstArg);
    if (route.target === "review") {
      arguments_ = ["review", ...arguments_];
    } else if (route.target === "issue") {
      arguments_ = ["issue", ...arguments_];
    } else if (route.target === "context") {
      arguments_ = ["context", "--root", firstArg, ...arguments_.slice(1)];
    }
  }

  try {
    await program.parseAsync([...arguments_], { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) {
        return EXIT_CODES.success;
      }

      if (error.code === "commander.unknownCommand") {
        output.writeDiagnostic(
          cliDiagnostic(
            "CLI.UNKNOWN_COMMAND",
            error.message.replace(/^error: /, ""),
          ),
        );
        return EXIT_CODES.validation;
      }

      output.writeDiagnostic(
        cliDiagnostic("CLI.INVALID_ARGUMENT", error.message),
      );
      return EXIT_CODES.validation;
    }

    const message =
      error instanceof Error ? error.message : "Unknown internal error.";
    output.writeDiagnostic(cliDiagnostic("CLI.INTERNAL", message), error);
    return EXIT_CODES.internal;
  }

  const unknownCommand = program.args[0];
  const recognizedCommand = program.commands.some(
    (command) => command.name() === unknownCommand,
  );
  if (unknownCommand && !recognizedCommand) {
    const message = `unknown command '${unknownCommand}'`;

    output.writeDiagnostic(cliDiagnostic("CLI.UNKNOWN_COMMAND", message));

    return CLI_USAGE_ERROR_EXIT_CODE;
  }

  return commandExitCode;
}
