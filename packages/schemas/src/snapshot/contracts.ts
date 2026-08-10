import { z } from "zod";

export const SNAPSHOT_SCHEMA_VERSION = 1 as const;

export const snapshotManifestSchema = z
  .object({
    schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
    id: z.string().regex(/^snapshot:[a-f0-9]{64}$/),
    repositoryRevision: z.string().nullable(),
    dirty: z.boolean(),
    configHash: z.string().min(1),
    fileFingerprints: z.array(
      z.object({
        path: z.string().min(1),
        sha256: z.string().min(1),
      }),
    ),
    bundleIdentityInputs: z.array(z.string()),
    complete: z.boolean(),
    diagnostics: z.array(z.string()),
    createdAt: z.string(),
  })
  .strict();

export type SnapshotManifest = z.infer<typeof snapshotManifestSchema>;
