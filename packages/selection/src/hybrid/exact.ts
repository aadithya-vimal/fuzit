export interface ExactIdentifierEvidence {
  readonly symbols?: readonly string[];
  readonly exports?: readonly string[];
  readonly routes?: readonly string[];
  readonly schemas?: readonly string[];
  readonly packages?: readonly string[];
  readonly aliases?: readonly string[];
  readonly paths?: readonly string[];
}

export interface ExactIdentifierScore {
  readonly value: number;
  readonly basis: string;
  readonly matchedTerms: readonly string[];
  readonly matchedIdentifiers: readonly string[];
}

const COMMON_TERMS = new Set([
  "app",
  "data",
  "file",
  "get",
  "index",
  "main",
  "set",
  "test",
  "type",
]);

export function normalizeIdentifierTokens(value: string): string[] {
  return value
    .normalize("NFKC")
    .replace(/([a-z\p{Ll}\d])([A-Z\p{Lu}])/gu, "$1 $2")
    .toLocaleLowerCase("en-US")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function scoreExactIdentifiers(
  task: string,
  evidence: ExactIdentifierEvidence,
): ExactIdentifierScore {
  const taskTerms = [...new Set(normalizeIdentifierTokens(task))].filter(
    (term) => term.length > 1 && !COMMON_TERMS.has(term),
  );
  const entries = Object.entries(evidence)
    .flatMap(([source, values]) =>
      (values ?? []).map((value: string) => ({
        identifier: value.normalize("NFKC"),
        weight: source === "paths" ? 0.75 : 1,
      })),
    )
    .sort((a, b) => a.identifier.localeCompare(b.identifier));
  const identifiers = entries.map(({ identifier }) => identifier);
  const matchedIdentifiers = identifiers.filter((identifier) => {
    const tokens = new Set(normalizeIdentifierTokens(identifier));
    return taskTerms.some((term) => tokens.has(term));
  });
  const matchedTerms = taskTerms.filter((term) =>
    matchedIdentifiers.some((identifier) =>
      normalizeIdentifierTokens(identifier).includes(term),
    ),
  );
  const value =
    taskTerms.length === 0
      ? 0
      : taskTerms.reduce(
          (sum, term) =>
            sum +
            Math.max(
              0,
              ...entries
                .filter(({ identifier }) =>
                  normalizeIdentifierTokens(identifier).includes(term),
                )
                .map(({ weight }) => weight),
            ),
          0,
        ) / taskTerms.length;
  return {
    value,
    basis:
      matchedIdentifiers.length === 0
        ? "no exact normalized identifier match"
        : `exact normalized identifier match: ${matchedIdentifiers.join(", ")}`,
    matchedTerms,
    matchedIdentifiers,
  };
}
