import { z } from "zod";

export const sensitivitySchema = z.enum([
  "public",
  "internal",
  "sensitive",
  "restricted",
  "unknown",
]);

export const redactionActionSchema = z.enum([
  "allow",
  "redact",
  "omit",
  "block",
]);

export const findingSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  kind: z.string().min(1),
  path: z.string().min(1),
  span: z.strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sensitivity: sensitivitySchema,
  confidence: z.number().min(0).max(1),
});

export const policyDecisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  action: redactionActionSchema,
  reason: z.string().min(1),
  findingIds: z.array(z.string().min(1)),
});

export const transformationRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  action: redactionActionSchema,
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  outputSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  findingIds: z.array(z.string().min(1)),
});

export type Sensitivity = z.infer<typeof sensitivitySchema>;
export type RedactionAction = z.infer<typeof redactionActionSchema>;
export type SecurityFinding = z.infer<typeof findingSchema>;
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;
export type TransformationRecord = z.infer<typeof transformationRecordSchema>;
