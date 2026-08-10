import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  SNAPSHOT_SCHEMA_VERSION,
  snapshotManifestSchema,
  type SnapshotManifest,
} from "@fuzit/schemas";

export * from "./delta/index.js";

export type SnapshotInput = Omit<
  SnapshotManifest,
  "schemaVersion" | "id" | "createdAt"
>;

export function createSnapshot(
  input: SnapshotInput,
  createdAt = new Date().toISOString(),
): SnapshotManifest {
  const identity = JSON.stringify({
    repositoryRevision: input.repositoryRevision,
    dirty: input.dirty,
    configHash: input.configHash,
    fileFingerprints: [...input.fileFingerprints].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
    bundleIdentityInputs: input.bundleIdentityInputs,
    complete: input.complete,
    diagnostics: input.diagnostics,
  });
  return snapshotManifestSchema.parse({
    ...input,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    id: `snapshot:${createHash("sha256").update(identity).digest("hex")}`,
    createdAt,
  });
}

export async function saveSnapshot(
  directory: string,
  snapshot: SnapshotManifest,
): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const name = `${snapshot.id.slice("snapshot:".length)}.json`;
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
  await rename(temporary, join(directory, name));
}

export async function listSnapshots(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
      .map((name) => `snapshot:${name.slice(0, -5)}`)
      .sort();
  } catch {
    return [];
  }
}

export async function readSnapshot(
  directory: string,
  id: string,
): Promise<SnapshotManifest> {
  return snapshotManifestSchema.parse(
    JSON.parse(
      await readFile(
        join(directory, `${id.slice("snapshot:".length)}.json`),
        "utf8",
      ),
    ),
  );
}
