import { z } from "zod";

export const fileContextItemSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^file:[a-f0-9]{64}$/),
  kind: z.literal("file"),
  path: z.string().min(1),
  content: z.string().nullable(),
  contentStatus: z.enum(["complete", "truncated", "omitted", "changed"]),
  provenance: z.strictObject({
    source: z.literal("scanner"),
    confidenceBasis: z.string().min(1),
  }),
  lifecycle: z.enum(["source", "generated", "vendored"]),
  sensitivity: z.literal("unclassified"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  transformations: z.array(z.string()),
});

export type FileContextItem = z.infer<typeof fileContextItemSchema>;
