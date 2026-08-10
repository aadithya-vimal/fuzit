import { BUILT_IN_PROFILES } from "@fuzit/profiles";
import type { Command } from "commander";
export function registerProfileCommand(
  program: Command,
  writeData: (value: unknown) => void,
) {
  program
    .command("profile")
    .description("display built-in profiles")
    .command("list")
    .option("--json")
    .action(() => writeData(BUILT_IN_PROFILES));
}
