import { resolve } from "node:path";

import {
  createSnapshot,
  listSnapshots,
  readSnapshot,
  saveSnapshot,
} from "@fuzit/snapshots";
import type { Command } from "commander";

import {
  acquireRepository,
  repositorySnapshotIdentity,
} from "../../application/repository.js";

export function registerSnapshotCommand(
  program: Command,
  runtime: {
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
  },
): void {
  const command = program.command("snapshot").description("Manage snapshots.");
  const directory = () =>
    resolve(runtime.environment.FUZIT_CACHE_HOME ?? ".cache", "snapshots");

  command
    .command("create")
    .requiredOption("--root <path>")
    .option("--json")
    .action(async ({ root }: { root: string }) => {
      const acquisition = await acquireRepository(root, runtime.environment);
      const identity = await repositorySnapshotIdentity(acquisition);
      const snapshot = createSnapshot({
        repositoryRevision: identity.revision,
        dirty: identity.dirty,
        configHash: acquisition.configHash,
        fileFingerprints: acquisition.items.map(({ path, sha256 }) => ({
          path,
          sha256,
        })),
        bundleIdentityInputs: [
          "scanner:1",
          "security-policy:1",
          "snapshot-schema:1",
        ],
        complete: acquisition.complete,
        diagnostics: acquisition.omissions
          .filter(({ failure }) => failure)
          .map(({ path, reason }) => `${path}: ${reason}`),
      });
      await saveSnapshot(directory(), snapshot);
      runtime.writeData(snapshot);
    });
  command
    .command("list")
    .action(async () => runtime.writeData(await listSnapshots(directory())));
  command
    .command("show")
    .argument("<id>")
    .action(async (id: string) =>
      runtime.writeData(await readSnapshot(directory(), id)),
    );
}
