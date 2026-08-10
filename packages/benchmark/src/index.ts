export interface RetrievalCase {
  readonly id: string;
  readonly repositoryFixture: string;
  readonly task: string;
  readonly expected: Readonly<Record<string, number>>;
  readonly selected: readonly string[];
  readonly symbolHints: readonly string[];
  readonly budgetTokens: number;
  readonly itemTokens?: Readonly<Record<string, number>>;
  readonly estimatorId?: string;
  readonly maxByteBudget?: number;
}

export interface RetrievalMetrics {
  readonly precision: number;
  readonly recall: number;
  readonly ndcg: number;
  readonly mrr: number;
  readonly bundleSize: number;
  readonly missingItems?: readonly string[];
  readonly extraItems?: readonly string[];
  readonly totalTokens?: number;
  readonly irrelevantTokens?: number;
  readonly irrelevantTokenRatio?: number;
  readonly totalBytes?: number;
  readonly estimatorId?: string;
  readonly exceedsByteBudget?: boolean;
}

export function measureRetrieval(input: RetrievalCase): RetrievalMetrics {
  const selectedDeduplicated = [...new Set(input.selected)];
  const relevant = Object.keys(input.expected);
  const hits = selectedDeduplicated.filter((path) => path in input.expected);
  const missingItems = relevant.filter(
    (path) => !selectedDeduplicated.includes(path),
  );
  const extraItems = selectedDeduplicated.filter(
    (path) => !(path in input.expected),
  );

  let totalTokens = 0;
  let irrelevantTokens = 0;
  if (input.itemTokens) {
    for (const path of selectedDeduplicated) {
      const tokens = input.itemTokens[path] ?? 0;
      totalTokens += tokens;
      if (!(path in input.expected)) {
        irrelevantTokens += tokens;
      }
    }
  }

  const estimatorId = input.estimatorId ?? "utf8-bytes-per-token:v1";
  const totalBytes = selectedDeduplicated.reduce(
    (acc, p) => acc + Buffer.byteLength(p, "utf8"),
    0,
  );
  const exceedsByteBudget =
    input.maxByteBudget !== undefined && totalBytes > input.maxByteBudget;

  const ideal = Object.values(input.expected).sort((a, b) => b - a);
  const gain = (grade: number, index: number) =>
    (2 ** grade - 1) / Math.log2(index + 2);
  const dcg = selectedDeduplicated.reduce(
    (sum, path, index) => sum + gain(input.expected[path] ?? 0, index),
    0,
  );
  const idcg = ideal.reduce((sum, grade, index) => sum + gain(grade, index), 0);
  const firstRelevant = selectedDeduplicated.findIndex(
    (path) => path in input.expected,
  );
  return {
    precision:
      selectedDeduplicated.length === 0
        ? 0
        : hits.length / selectedDeduplicated.length,
    recall: relevant.length === 0 ? 1 : hits.length / relevant.length,
    ndcg: idcg === 0 ? 1 : dcg / idcg,
    mrr: firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1),
    bundleSize: selectedDeduplicated.length,
    missingItems,
    extraItems,
    totalTokens,
    irrelevantTokens,
    irrelevantTokenRatio:
      totalTokens === 0 ? 0 : irrelevantTokens / totalTokens,
    totalBytes,
    estimatorId,
    exceedsByteBudget,
  };
}

export function aggregateRetrievalMetrics(
  metricsList: readonly RetrievalMetrics[],
): RetrievalMetrics & { readonly caseCount: number } {
  if (metricsList.length === 0) {
    return {
      precision: 0,
      recall: 0,
      ndcg: 0,
      mrr: 0,
      bundleSize: 0,
      caseCount: 0,
    };
  }
  const sum = metricsList.reduce(
    (acc, m) => ({
      precision: acc.precision + m.precision,
      recall: acc.recall + m.recall,
      ndcg: acc.ndcg + m.ndcg,
      mrr: acc.mrr + m.mrr,
      bundleSize: acc.bundleSize + m.bundleSize,
    }),
    { precision: 0, recall: 0, ndcg: 0, mrr: 0, bundleSize: 0 },
  );
  const count = metricsList.length;
  return {
    precision: sum.precision / count,
    recall: sum.recall / count,
    ndcg: sum.ndcg / count,
    mrr: sum.mrr / count,
    bundleSize: sum.bundleSize / count,
    caseCount: count,
  };
}

export function compareBaseline(
  current: RetrievalMetrics,
  baseline: RetrievalMetrics,
  tolerance = 0.001,
): { readonly regressed: boolean; readonly deltas: RetrievalMetrics } {
  const deltas = {
    precision: current.precision - baseline.precision,
    recall: current.recall - baseline.recall,
    ndcg: current.ndcg - baseline.ndcg,
    mrr: current.mrr - baseline.mrr,
    bundleSize: current.bundleSize - baseline.bundleSize,
  };
  const numericKeys: readonly (keyof typeof deltas)[] = [
    "precision",
    "recall",
    "ndcg",
    "mrr",
  ];
  return {
    regressed: numericKeys.some((key) => deltas[key] < -tolerance),
    deltas,
  };
}

export * from "./ablation.js";
export * from "./schema.js";
