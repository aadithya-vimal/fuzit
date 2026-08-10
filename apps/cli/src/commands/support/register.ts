import { createSupportBundlePreview } from "@fuzit/security";
import type { Command } from "commander";

export function registerSupportCommand(
  program: Command,
  version: string,
  writeData: (value: unknown) => void,
): void {
  program
    .command("support")
    .description("preview a bounded metadata-only support bundle")
    .requiredOption("--preview", "preview locally without writing or uploading")
    .action(() => {
      writeData(
        createSupportBundlePreview({
          productVersion: version,
          checks: [{ surface: "local-verification", status: "pass" }],
        }),
      );
    });
}
