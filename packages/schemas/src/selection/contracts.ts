import { z } from "zod";

export const scoreContributionSchema = z.strictObject({
  source: z.string().min(1),
  value: z.number(),
  reason: z.string().min(1),
});
export const candidateSchema = z.strictObject({
  id: z.string().min(1),
  path: z.string().min(1),
  mandatory: z.boolean(),
  uncertainty: z.number().min(0).max(1),
  contributions: z.array(scoreContributionSchema),
});
export const selectionDecisionSchema = z.strictObject({
  candidate: candidateSchema,
  included: z.boolean(),
  score: z.number(),
  exclusionReason: z.string().nullable(),
});
export const taskIntentSchema = z.strictObject({
  text: z.string(),
  paths: z.array(z.string()),
});
export const contextProfileSchema = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().positive(),
  weights: z.record(z.string(), z.number()),
});
export const selectionReportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: contextProfileSchema,
  decisions: z.array(selectionDecisionSchema),
});
export type Candidate = z.infer<typeof candidateSchema>;
export type ContextProfile = z.infer<typeof contextProfileSchema>;
export type ScoreContribution = z.infer<typeof scoreContributionSchema>;
export type SelectionDecision = z.infer<typeof selectionDecisionSchema>;
export type SelectionReport = z.infer<typeof selectionReportSchema>;
export type TaskIntent = z.infer<typeof taskIntentSchema>;
