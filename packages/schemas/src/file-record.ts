import { z } from "zod";

export const fileRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  path: z.string().min(1),
  kind: z.enum(["text", "binary", "symlink", "other"]),
  extension: z.string(),
  language: z.strictObject({
    name: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
  sizeBytes: z.number().int().nonnegative(),
  symlink: z.boolean(),
  generated: z.boolean(),
  vendored: z.boolean(),
  readable: z.boolean(),
});

export type FileRecord = z.infer<typeof fileRecordSchema>;
