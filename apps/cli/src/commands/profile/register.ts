import { BUILT_IN_PROFILES } from "@fuzit/profiles";
import type { Command } from "commander";
export function registerProfileCommand(
  program: Command,
  writeData: (value: unknown) => void,
) {
  const profile = program
    .command("profile")
    .description("display built-in profiles")
    .action(() => writeData(BUILT_IN_PROFILES));

  profile
    .command("list")
    .option("--json")
    .action(() => writeData(BUILT_IN_PROFILES));
}
