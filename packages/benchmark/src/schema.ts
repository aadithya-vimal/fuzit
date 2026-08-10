export const V1_RETRIEVAL_BENCHMARK_SCHEMA_VERSION = 1 as const;

export type BenchmarkTaskCategory =
  | "bug-fix"
  | "architecture-security"
  | "feature"
  | "test"
  | "dependency"
  | "endpoint"
  | "migration";

export type BenchmarkItemClassification =
  "required" | "useful" | "irrelevant" | "prohibited";

export interface BenchmarkItemExpectation {
  readonly path: string;
  readonly classification: BenchmarkItemClassification;
  readonly relevanceGrade: number;
}

export interface GraphExpectation {
  readonly maxDistance?: number;
  readonly requiredNodeIds?: readonly string[];
  readonly requiredEdgeKinds?: readonly string[];
}

export interface RetrievalBenchmarkCase {
  readonly schemaVersion: typeof V1_RETRIEVAL_BENCHMARK_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly category: BenchmarkTaskCategory;
  readonly repositoryFixture: string;
  readonly task: string;
  readonly profile: string;
  readonly budgetTokens: number;
  readonly expectedItems: readonly BenchmarkItemExpectation[];
  readonly graphExpectations?: GraphExpectation;
  readonly environmentMetadata?: Readonly<Record<string, string>>;
}

export function validateBenchmarkCase(
  item: unknown,
): item is RetrievalBenchmarkCase {
  if (typeof item !== "object" || item === null) return false;
  const candidate = item as Partial<RetrievalBenchmarkCase>;
  return (
    candidate.schemaVersion === V1_RETRIEVAL_BENCHMARK_SCHEMA_VERSION &&
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.task === "string" &&
    typeof candidate.repositoryFixture === "string" &&
    typeof candidate.profile === "string" &&
    typeof candidate.budgetTokens === "number" &&
    candidate.budgetTokens > 0 &&
    Array.isArray(candidate.expectedItems) &&
    candidate.expectedItems.every(
      (expected) =>
        typeof expected?.path === "string" &&
        ["required", "useful", "irrelevant", "prohibited"].includes(
          expected.classification,
        ) &&
        typeof expected.relevanceGrade === "number",
    )
  );
}
