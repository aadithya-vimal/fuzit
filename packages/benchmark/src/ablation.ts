import { measureRetrieval, type RetrievalMetrics } from "./index.js";

export const RETRIEVAL_BASELINE_SCHEMA_VERSION = 1 as const;
export type ContributionSource = "lexical" | "git" | "dependency" | "profile";

export interface AblationCandidate {
  readonly path: string;
  readonly language: string;
  readonly tokens: number;
  readonly contributions: Readonly<Record<ContributionSource, number>>;
}

export function evaluateAblation(input: {
  readonly id: string;
  readonly repositoryFixture: "small" | "medium" | "monorepo";
  readonly task: string;
  readonly expected: Readonly<Record<string, number>>;
  readonly candidates: readonly AblationCandidate[];
  readonly budgetTokens: number;
  readonly disabled?: readonly ContributionSource[];
}): RetrievalMetrics {
  const disabled = new Set(input.disabled ?? []);
  let used = 0;
  const selected = [...input.candidates]
    .map((candidate) => ({
      candidate,
      score: Object.entries(candidate.contributions).reduce(
        (sum, [source, value]) =>
          sum + (disabled.has(source as ContributionSource) ? 0 : value),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.path.localeCompare(right.candidate.path),
    )
    .filter(({ candidate }) => {
      if (used + candidate.tokens > input.budgetTokens) return false;
      used += candidate.tokens;
      return true;
    })
    .map(({ candidate }) => candidate.path);
  return measureRetrieval({
    id: input.id,
    repositoryFixture: input.repositoryFixture,
    task: input.task,
    expected: input.expected,
    selected,
    symbolHints: [],
    budgetTokens: input.budgetTokens,
  });
}
