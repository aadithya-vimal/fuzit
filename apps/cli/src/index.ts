import { CLI_USAGE_ERROR_EXIT_CODE, CLI_VERSION, runCli } from "./cli.js";

export { CLI_USAGE_ERROR_EXIT_CODE, CLI_VERSION, runCli };

export async function runCliProcess(
  arguments_: readonly string[],
): Promise<number> {
  return runCli(arguments_, {
    writeOut: (value) => process.stdout.write(value),
    writeErr: (value) => process.stderr.write(value),
  });
}

export interface CliPackageBoundary {
  readonly packageName: "@fuzit/cli";
}
