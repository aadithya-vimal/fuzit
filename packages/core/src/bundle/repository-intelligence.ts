export interface RepositoryIntelligence {
  readonly languages: string[];
  readonly packages: string[];
  readonly frameworks: string[];
  readonly tests: string[];
  readonly entryPoints: string[];
  readonly dependencies: string[];
  readonly conflicts: string[];
  readonly partial: boolean;
}

export function normalizeRepositoryIntelligence(
  input: RepositoryIntelligence,
): RepositoryIntelligence {
  const sorted = (values: readonly string[]) => [...new Set(values)].sort();
  return {
    languages: sorted(input.languages),
    packages: sorted(input.packages),
    frameworks: sorted(input.frameworks),
    tests: sorted(input.tests),
    entryPoints: sorted(input.entryPoints),
    dependencies: sorted(input.dependencies),
    conflicts: sorted(input.conflicts),
    partial: input.partial,
  };
}
