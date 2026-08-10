import { z } from "zod";

export const WATCHER_CONTRACT_VERSION = 1 as const;

export const filesystemEventKindSchema = z.enum([
  "add",
  "modify",
  "delete",
  "rename",
  "directory-rename",
  "overflow",
]);

export type FilesystemEventKind = z.infer<typeof filesystemEventKindSchema>;

export const watcherEventSchema = z
  .object({
    contractVersion: z.literal(WATCHER_CONTRACT_VERSION),
    kind: filesystemEventKindSchema,
    path: z.string().min(1),
    renamedTo: z.string().min(1).optional(),
    timestampMs: z.number().positive(),
  })
  .strict();

export type WatcherEvent = z.infer<typeof watcherEventSchema>;

export const watcherBatchSchema = z
  .object({
    contractVersion: z.literal(WATCHER_CONTRACT_VERSION),
    batchId: z.string().min(1),
    events: z.array(watcherEventSchema),
    reconciliationRequired: z.boolean(),
    overflowOccurred: z.boolean(),
  })
  .strict();

export type WatcherBatch = z.infer<typeof watcherBatchSchema>;

export const watcherStatusSchema = z
  .object({
    contractVersion: z.literal(WATCHER_CONTRACT_VERSION),
    state: z.enum([
      "stopped",
      "starting",
      "watching",
      "reconciling",
      "stopping",
      "error",
    ]),
    repositoryRoot: z.string().min(1),
    lockOwner: z.string().min(1).nullable(),
    activeWatchers: z.number().nonnegative(),
    eventsProcessed: z.number().nonnegative(),
    lastEventTimestampMs: z.number().nullable(),
  })
  .strict();

export type WatcherStatus = z.infer<typeof watcherStatusSchema>;

export function validateWatcherEvent(event: unknown): WatcherEvent {
  const parsed = watcherEventSchema.parse(event);
  if (
    parsed.path.startsWith("/") ||
    parsed.path.startsWith("\\") ||
    parsed.path.includes("..")
  ) {
    throw new Error(
      "Watcher event path must be relative to repository root and contain no path traversal.",
    );
  }
  if (
    parsed.renamedTo &&
    (parsed.renamedTo.startsWith("/") ||
      parsed.renamedTo.startsWith("\\") ||
      parsed.renamedTo.includes(".."))
  ) {
    throw new Error(
      "Watcher event renamedTo path must be relative to repository root and contain no path traversal.",
    );
  }
  return parsed;
}
