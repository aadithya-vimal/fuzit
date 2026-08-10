import type { ContextProfile } from "@fuzit/schemas";

export type ProfileEdgeType = "dependency" | "reverse-dependency" | "test";

export interface ProfileExpansionPolicy {
  readonly allowedEdgeTypes: readonly ProfileEdgeType[];
  readonly maximumDepth: number;
  readonly maximumItems: number;
  readonly maximumEdges: number;
  readonly minimumConfidence: number;
}

export interface SelectionProfile extends ContextProfile {
  readonly expansion: ProfileExpansionPolicy;
}

const DEFAULT_WEIGHTS: Readonly<Record<string, number>> = {
  lexical: 1,
  exact: 2,
  dependency: 1,
  test: 1,
  manifest: 1,
  "git-recency": 0,
  "git-frequency": 0,
  "git-co-change": 0,
  "git-task-diff": 1,
  lifecycle: 1,
  security: 1,
  doc: 0,
};

const policy = (
  allowedEdgeTypes: readonly ProfileEdgeType[],
  maximumDepth: number,
  maximumItems: number,
): ProfileExpansionPolicy => ({
  allowedEdgeTypes,
  maximumDepth,
  maximumItems,
  maximumEdges: maximumItems * 4,
  minimumConfidence: 0.5,
});

const profile = (
  id: string,
  weights: Readonly<Record<string, number>>,
  expansion: ProfileExpansionPolicy,
): SelectionProfile => ({
  id,
  version: 1,
  weights: { ...DEFAULT_WEIGHTS, ...weights },
  expansion,
});

export const BUILT_IN_PROFILES = [
  profile(
    "bug-fix",
    { lexical: 3, exact: 4, "git-recency": 2, "git-frequency": 1, test: 3 },
    policy(["dependency", "reverse-dependency", "test"], 2, 40),
  ),
  profile(
    "feature-development",
    { lexical: 3, exact: 3, dependency: 3, manifest: 2 },
    policy(["dependency", "reverse-dependency", "test"], 2, 50),
  ),
  profile(
    "code-review",
    { "git-task-diff": 4, "git-recency": 2, "git-co-change": 2, dependency: 1 },
    policy(["dependency", "test"], 1, 30),
  ),
  profile(
    "security-audit",
    { security: 5, dependency: 3, exact: 2 },
    policy(["dependency", "reverse-dependency"], 3, 60),
  ),
  profile(
    "architecture-review",
    { dependency: 4, manifest: 3, "git-co-change": 2 },
    policy(["dependency", "reverse-dependency"], 3, 80),
  ),
  profile(
    "documentation",
    { doc: 5, lexical: 2, exact: 2, dependency: 0.5 },
    policy(["dependency"], 1, 25),
  ),
] as const;

export function getProfile(
  id: string,
  overrides: Readonly<Record<string, number>> = {},
): SelectionProfile {
  const found = BUILT_IN_PROFILES.find((profile) => profile.id === id);
  if (!found) throw new Error(`Unknown profile: ${id}`);
  return {
    ...found,
    weights: { ...found.weights, ...overrides },
    expansion: { ...found.expansion },
  };
}
