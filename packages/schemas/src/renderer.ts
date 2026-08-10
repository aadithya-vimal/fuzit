import { z } from "zod";

export const rendererMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  format: z.string().regex(/^[a-z][a-z0-9-]*$/),
  mediaType: z.string().min(1),
  extension: z.string().regex(/^\.[a-z0-9]+$/),
  capabilities: z.strictObject({
    binary: z.boolean(),
    diagnostics: z.boolean(),
    provenance: z.boolean(),
  }),
  deterministic: z.literal(true),
});

export type RendererMetadata = z.infer<typeof rendererMetadataSchema>;
