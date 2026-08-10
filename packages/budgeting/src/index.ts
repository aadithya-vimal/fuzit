import { budgetEstimateSchema, type BudgetEstimate } from "@fuzit/schemas";

export * from "./enforcement/index.js";

export interface TokenEstimator {
  readonly id: string;
  readonly uncertainty: number;
  readonly estimate: (content: string) => number;
}

export const utf8BytesPerTokenEstimator: TokenEstimator = {
  id: "utf8-bytes-per-token:v1",
  uncertainty: 0.25,
  estimate: (content) => Math.ceil(Buffer.byteLength(content, "utf8") / 4),
};

export function estimateBudget(
  content: string,
  options: {
    readonly metadata?: unknown;
    readonly estimator?: TokenEstimator;
    readonly maximumTokens?: number;
  } = {},
): BudgetEstimate {
  const estimator = options.estimator ?? utf8BytesPerTokenEstimator;
  const metadataBytes =
    options.metadata === undefined
      ? 0
      : Buffer.byteLength(JSON.stringify(options.metadata), "utf8");
  const estimatedTokens = estimator.estimate(content);
  return budgetEstimateSchema.parse({
    schemaVersion: 1,
    bytes: Buffer.byteLength(content, "utf8") + metadataBytes,
    metadataBytes,
    estimatedTokens,
    estimator: estimator.id,
    uncertainty: estimator.uncertainty,
    exceedsBudget:
      options.maximumTokens !== undefined &&
      estimatedTokens > options.maximumTokens,
  });
}
