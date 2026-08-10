import type { Candidate, SelectionDecision } from "@fuzit/schemas";
export * from "./lexical/index.js";
export * from "./scorers/index.js";
export * from "./expansion/index.js";
export * from "./report/index.js";
export * from "./hybrid/index.js";
export * from "./provider-enrichment.js";
export function decideCandidates(
  candidates: readonly Candidate[],
): SelectionDecision[] {
  return [...candidates]
    .map((candidate) => {
      const score = candidate.contributions.reduce(
        (sum, contribution) => sum + contribution.value,
        0,
      );
      return {
        candidate,
        included: candidate.mandatory || score > 0,
        score,
        exclusionReason:
          candidate.mandatory || score > 0 ? null : "non-positive score",
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.path.localeCompare(b.candidate.path),
    );
}
