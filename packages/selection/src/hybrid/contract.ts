export const HYBRID_SCORING_SCHEMA_VERSION = 1 as const;

export interface HybridFeatureVector {
  readonly schemaVersion: 1;
  readonly candidateId: string;
  readonly path: string;
  readonly requiredAnchor: boolean;
  readonly features: Readonly<Record<string, number>>;
}

export interface HybridComponentScore {
  readonly component: string;
  readonly rawValue: number;
  readonly weight: number;
  readonly weightedValue: number;
  readonly basis: string;
}

export interface HybridExpansionEvidence {
  readonly originCandidateId: string;
  readonly graphPath: readonly string[];
  readonly edgeTypes: readonly string[];
  readonly reason: string;
  readonly bounds: Readonly<Record<string, number>>;
}

export interface HybridScoreRecord {
  readonly schemaVersion: 1;
  readonly featureVector: HybridFeatureVector;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly components: readonly HybridComponentScore[];
  readonly aggregateScore: number;
  readonly expansion: HybridExpansionEvidence | null;
  readonly tieBreaker: readonly [path: string, candidateId: string];
}

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
};

export function createHybridScore(input: {
  readonly featureVector: HybridFeatureVector;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly weights: Readonly<Record<string, number>>;
  readonly basis: Readonly<Record<string, string>>;
  readonly expansion?: HybridExpansionEvidence | null;
}): HybridScoreRecord {
  if (input.featureVector.schemaVersion !== HYBRID_SCORING_SCHEMA_VERSION) {
    throw new Error("Hybrid feature vector version is unsupported");
  }
  if (!Number.isInteger(input.profileVersion) || input.profileVersion < 1) {
    throw new Error("Profile version is required");
  }
  const components = Object.entries(input.featureVector.features)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([component, raw]) => {
      const basis = input.basis[component];
      if (!basis) throw new Error(`Score basis is required for ${component}`);
      const rawValue = finite(raw, `${component} feature`);
      const weight = finite(
        input.weights[component] ?? 0,
        `${component} weight`,
      );
      return {
        component,
        rawValue,
        weight,
        weightedValue: finite(rawValue * weight, `${component} score`),
        basis,
      };
    });
  const aggregateScore = finite(
    components.reduce((sum, component) => sum + component.weightedValue, 0),
    "Aggregate score",
  );
  return {
    schemaVersion: HYBRID_SCORING_SCHEMA_VERSION,
    featureVector: {
      ...input.featureVector,
      features: Object.fromEntries(
        Object.entries(input.featureVector.features).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      ),
    },
    profileId: input.profileId,
    profileVersion: input.profileVersion,
    components,
    aggregateScore,
    expansion: input.expansion ?? null,
    tieBreaker: [input.featureVector.path, input.featureVector.candidateId],
  };
}

export function compareHybridScores(
  left: HybridScoreRecord,
  right: HybridScoreRecord,
): number {
  return (
    right.aggregateScore - left.aggregateScore ||
    left.tieBreaker[0].localeCompare(right.tieBreaker[0]) ||
    left.tieBreaker[1].localeCompare(right.tieBreaker[1])
  );
}

export function serializeHybridScore(record: HybridScoreRecord): string {
  if (record.schemaVersion !== HYBRID_SCORING_SCHEMA_VERSION) {
    throw new Error("Hybrid score version is unsupported");
  }
  return `${JSON.stringify(record)}\n`;
}
