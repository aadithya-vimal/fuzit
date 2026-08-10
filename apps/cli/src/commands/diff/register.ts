import { resolve } from "node:path";

import { computeSnapshotDelta, readSnapshot } from "@fuzit/snapshots";
import type { Command } from "commander";

export function registerDiffCommand(
  program: Command,
  runtime: {
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
  },
): void {
  program
    .command("diff")
    .argument("<snapshot-a>")
    .argument("<snapshot-b>")
    .option("--json")
    .description("Compare immutable snapshots.")
    .action(async (snapshotA: string, snapshotB: string) => {
      const directory = resolve(
        runtime.environment.FUZIT_CACHE_HOME ?? ".cache",
        "snapshots",
      );
      runtime.writeData(
        computeSnapshotDelta(
          await readSnapshot(directory, snapshotA),
          await readSnapshot(directory, snapshotB),
        ),
      );
    });
}
