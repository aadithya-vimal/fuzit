import { z } from "zod";

export const contextBundleSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^bundle:[a-f0-9]{64}$/),
  source: z.strictObject({
    kind: z.literal("repository"),
    root: z.string().min(1),
  }),
  revision: z.string().nullable(),
  items: z.array(
    z.strictObject({
      id: z.string().min(1),
      path: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      contentStatus: z.enum(["complete", "truncated", "omitted", "changed"]),
      redacted: z.boolean(),
    }),
  ),
  redactionSummary: z.strictObject({
    findings: z.number().int().nonnegative(),
    redactedItems: z.number().int().nonnegative(),
    omittedItems: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()),
  failedSources: z.array(z.string()),
  budget: z.strictObject({
    bytes: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  intelligence: z
    .strictObject({
      languages: z.array(z.string()),
      packages: z.array(z.string()),
      frameworks: z.array(z.string()),
      tests: z.array(z.string()),
      entryPoints: z.array(z.string()),
      dependencies: z.array(z.string()),
      conflicts: z.array(z.string()),
      partial: z.boolean(),
    })
    .optional(),
  git: z
    .strictObject({
      identity: z.unknown(),
      changes: z.array(z.unknown()),
      history: z.array(z.unknown()),
      diff: z.unknown().nullable(),
    })
    .optional(),
  instruction: z.string().optional(),
});

export type ContextBundle = z.infer<typeof contextBundleSchema>;
