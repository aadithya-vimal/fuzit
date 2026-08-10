import { z } from "zod";

export const budgetEstimateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  bytes: z.number().int().nonnegative(),
  metadataBytes: z.number().int().nonnegative(),
  estimatedTokens: z.number().int().nonnegative(),
  estimator: z.string().min(1),
  uncertainty: z.number().min(0).max(1),
  exceedsBudget: z.boolean(),
});

export type BudgetEstimate = z.infer<typeof budgetEstimateSchema>;
