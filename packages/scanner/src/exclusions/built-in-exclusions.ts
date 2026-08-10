import type { RepositoryRelativePath } from "@fuzit/core";

export type BuiltInExclusionRuleId =
  | "safety.vcs"
  | "safety.dependencies"
  | "default.cache"
  | "default.build-output"
  | "safety.fuzit-state"
  | "default.os-metadata";

export interface BuiltInExclusionRule {
  readonly id: BuiltInExclusionRuleId;
  readonly hard: boolean;
  readonly reason: string;
}

export interface ExclusionDecision {
  readonly schemaVersion: 1;
  readonly path: RepositoryRelativePath;
  readonly excluded: boolean;
  readonly explicitlyIncluded: boolean;
  readonly rule: BuiltInExclusionRule | null;
}

const directoryRules: readonly {
  readonly names: ReadonlySet<string>;
  readonly rule: BuiltInExclusionRule;
}[] = [
  {
    names: new Set([".git", ".hg", ".svn"]),
    rule: {
      id: "safety.vcs",
      hard: true,
      reason: "Version-control internals are never scanned.",
    },
  },
  {
    names: new Set(["node_modules", ".pnpm-store", "bower_components"]),
    rule: {
      id: "safety.dependencies",
      hard: true,
      reason: "Dependency stores are never scanned.",
    },
  },
  {
    names: new Set([".cache", ".turbo"]),
    rule: {
      id: "default.cache",
      hard: false,
      reason: "Generated cache directories are excluded by default.",
    },
  },
  {
    names: new Set(["dist", "build", "out", "coverage"]),
    rule: {
      id: "default.build-output",
      hard: false,
      reason: "Generated build output is excluded by default.",
    },
  },
  {
    names: new Set([".fuzit", ".fuzit-index"]),
    rule: {
      id: "safety.fuzit-state",
      hard: true,
      reason: "Fuzit output and index state are never scanned.",
    },
  },
];

const osMetadata = new Set([".DS_Store", "Thumbs.db", "Desktop.ini"]);
const osMetadataRule: BuiltInExclusionRule = {
  id: "default.os-metadata",
  hard: false,
  reason: "Operating-system metadata is excluded by default.",
};

export function evaluateBuiltInExclusion(
  path: RepositoryRelativePath,
  options: { readonly explicitlyIncluded?: boolean } = {},
): ExclusionDecision {
  const segments = path.split("/");
  let rule =
    directoryRules.find(({ names }) =>
      segments.some((segment) => names.has(segment)),
    )?.rule ?? null;

  if (rule === null && osMetadata.has(segments.at(-1) ?? "")) {
    rule = osMetadataRule;
  }

  const explicitlyIncluded = options.explicitlyIncluded ?? false;
  return {
    schemaVersion: 1,
    path,
    excluded: rule !== null && (rule.hard || !explicitlyIncluded),
    explicitlyIncluded,
    rule,
  };
}
