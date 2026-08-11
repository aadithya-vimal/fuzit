import { readFileSync } from "node:fs";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import { Command, CommanderError, Option } from "commander";

import { registerConfigCommand } from "./config/register.js";
import { registerDoctorCommand } from "./commands/doctor/register.js";
import { registerInitCommand } from "./commands/init/register.js";
import { registerScanCommand } from "./commands/scan/register.js";
import { executeDualPack, registerPackCommand } from "./commands/pack/register.js";
import { registerGitCommand } from "./commands/git/register.js";
import { registerCacheCommand } from "./commands/cache/register.js";
import { registerSnapshotCommand } from "./commands/snapshot/register.js";
import { registerDiffCommand } from "./commands/diff/register.js";
import { registerProfileCommand } from "./commands/profile/register.js";
import { registerContextCommand } from "./commands/context/register.js";
import { registerExplainCommand } from "./commands/explain/register.js";
import { registerWatchCommand } from "./commands/watch/register.js";
import { registerGraphCommand } from "./commands/graph/register.js";
import { registerAuthCommand } from "./commands/auth/register.js";
import {
  registerReviewCommand,
  registerPrCommand,
} from "./commands/review/register.js";
import { registerIssueCommand } from "./commands/issue/register.js";
import { registerPluginCommand } from "./commands/plugin/register.js";
import { registerSupportCommand } from "./commands/support/register.js";
import { registerServeCommand } from "./commands/serve/register.js";
import { registerApplyCommand } from "./commands/apply/register.js";
import { registerUiCommand } from "./commands/ui/register.js";
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
  const operation = [
    "scan",
    "pack",
    "context",
    "cache",
    "snapshot",
    "watch",
    "graph",
    "review",
    "pr",
    "issue",
    "plugin",
  ].find((name) => arguments_.includes(name));
  const activityStarted =
    operation !== undefined &&
    !arguments_.includes("--help") &&
    !arguments_.includes("-h");
  const startedAt = performance.now();
  if (activityStarted) {
    const labels: Record<string, string> = {
      scan: "Scanning repository",
      pack: "Packing repository",
      context: "Building task context",
      cache: "Updating local index",
      snapshot: "Processing snapshot",
      watch: "Starting repository watch",
      graph: "Building repository graph",
      review: "Fetching and reviewing pull request",
      auth: "Managing GitHub authentication",
      pr: "Fetching and reviewing pull request",
      issue: "Fetching issue context",
      plugin: "Inspecting plugins",
    };
    if (operation === "graph") {
      const graphIndex = arguments_.indexOf("graph");
      const graphOperation = arguments_[graphIndex + 1];
      labels.graph =
        graphOperation === "build"
          ? "Building repository graph"
          : graphOperation === "stats"
            ? "Reading graph statistics"
            : graphOperation === "neighbors"
              ? "Finding graph neighbors"
              : graphOperation === "impact"
                ? "Analyzing graph impact"
                : graphOperation === "query"
                  ? "Querying repository graph"
                  : "Processing repository graph";
    }
    output.writeActivity(
      `Fuzit v${CLI_VERSION} · ${labels[operation!] ?? "Working"}...`,
    );
  }

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
  registerAuthCommand(program, {
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (code) => {
      commandExitCode = code;
    },
  });
  registerGraphCommand(program, {
    repositoryRoot: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
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
  registerServeCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (code) => {
      commandExitCode = code;
    },
  });
  registerApplyCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (code) => {
      commandExitCode = code;
    },
  });
  registerUiCommand(program, {
    currentDirectory: runtime.repositoryRoot ?? process.cwd(),
    environment: runtime.environment ?? process.env,
    writeData: output.writeData,
    setExitCode: (code) => {
      commandExitCode = code;
    },
  });

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
      // GitHub repo URL → pack the remote repository
      arguments_ = ["pack", "--remote", firstArg, ...arguments_.slice(1)];
    }
  }

  const positionalArgs = arguments_.filter((arg) => !arg.startsWith("-"));
  const helpOrVersion = arguments_.some((arg) =>
    ["--help", "-h", "--version", "-V", "help"].includes(arg),
  );

  if (positionalArgs.length === 0 && !helpOrVersion) {
    try {
      const root = runtime.repositoryRoot ?? process.cwd();
      const dualResult = await executeDualPack(
        root,
        runtime.environment ?? process.env,
      );
      output.writeData(dualResult);
      return EXIT_CODES.success;
    } catch (error) {
      output.writeDiagnostic(
        cliDiagnostic(
          "CLI.INTERNAL",
          error instanceof Error ? error.message : String(error),
        ),
        error,
      );
      return EXIT_CODES.internal;
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

  if (activityStarted && commandExitCode === EXIT_CODES.success) {
    output.writeActivity(
      `Fuzit v${CLI_VERSION} · ${operation} complete (${((performance.now() - startedAt) / 1_000).toFixed(2)}s)`,
    );
  }
  return commandExitCode;
}
