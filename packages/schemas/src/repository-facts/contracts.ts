import { z } from "zod";

export const repositoryFactKindSchema = z.enum([
  "language",
  "manifest",
  "package",
  "workspace",
  "framework",
  "test",
  "entry-point",
  "service",
  "dependency",
]);
export const repositoryFactSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^fact:[a-f0-9]{64}$/),
  kind: repositoryFactKindSchema,
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
  basis: z.enum(["direct", "inferred"]),
  evidence: z.array(z.string()).min(1),
  detector: z.string().min(1),
  conflictsWith: z.array(z.string()),
});
export type RepositoryFact = z.infer<typeof repositoryFactSchema>;
export type RepositoryFactKind = z.infer<typeof repositoryFactKindSchema>;
