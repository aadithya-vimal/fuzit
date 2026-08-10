import { z } from "zod";

export const LOCAL_INDEX_SCHEMA_VERSION = 1 as const;

export const localIndexRepositoryIdSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const localIndexStatusSchema = z
  .object({
    schemaVersion: z.literal(LOCAL_INDEX_SCHEMA_VERSION),
    repositoryId: localIndexRepositoryIdSchema,
    path: z.string().min(1),
    state: z.enum([
      "absent",
      "ready",
      "stale",
      "incomplete",
      "corrupt",
      "schema-mismatch",
      "repository-mismatch",
      "policy-mismatch",
      "rebuild-required",
      "locked",
    ]),
    rebuildRequired: z.boolean(),
    lockOwner: z.string().min(1).nullable(),
  })
  .strict();

export type LocalIndexStatus = z.infer<typeof localIndexStatusSchema>;
