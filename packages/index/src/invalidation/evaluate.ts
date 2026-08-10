import type { IndexIdentitySet } from "./identities.js";

export interface IndexSemanticVersions {
  readonly contentHash: string;
  readonly configHash: string;
  readonly scannerVersion: string;
  readonly parserVersion: string;
  readonly securityPolicyVersion: string;
  readonly schemaVersion: number;
  readonly identities?: IndexIdentitySet;
}

export interface InvalidationDecision {
  readonly valid: boolean;
  readonly reasons: readonly string[];
  readonly action: "reuse" | "rebuild";
  readonly affectedRecordTypes: readonly ("file" | "analysis" | "graph")[];
}

const identityDependencies = {
  effectiveConfiguration: ["file", "analysis", "graph"],
  ignorePolicy: ["file", "analysis", "graph"],
  securityPolicy: ["file", "analysis", "graph"],
  parser: ["analysis", "graph"],
  analysis: ["analysis", "graph"],
  graph: ["graph"],
  schema: ["file", "analysis", "graph"],
} as const satisfies Record<
  keyof IndexIdentitySet,
  readonly ("file" | "analysis" | "graph")[]
>;

export function evaluateInvalidation(
  stored: IndexSemanticVersions,
  current: IndexSemanticVersions,
  options: { readonly corrupt?: boolean } = {},
): InvalidationDecision {
  const reasons: string[] = [];
  const affected = new Set<"file" | "analysis" | "graph">();
  if (options.corrupt) {
    reasons.push("index corruption detected");
    for (const kind of ["file", "analysis", "graph"] as const)
      affected.add(kind);
  }
  for (const key of [
    "contentHash",
    "configHash",
    "scannerVersion",
    "parserVersion",
    "securityPolicyVersion",
    "schemaVersion",
  ] as const) {
    if (stored[key] !== current[key]) {
      reasons.push(`${key} changed`);
      for (const kind of ["file", "analysis", "graph"] as const)
        affected.add(kind);
    }
  }
  if (stored.identities === undefined || current.identities === undefined) {
    if (stored.identities !== current.identities) {
      reasons.push("identity set changed");
      for (const kind of ["file", "analysis", "graph"] as const)
        affected.add(kind);
    }
  } else {
    for (const key of Object.keys(
      identityDependencies,
    ) as (keyof IndexIdentitySet)[]) {
      if (stored.identities[key] !== current.identities[key]) {
        reasons.push(`${key} identity changed`);
        for (const kind of identityDependencies[key]) affected.add(kind);
      }
    }
  }
  return {
    valid: reasons.length === 0,
    reasons,
    action: reasons.length === 0 ? "reuse" : "rebuild",
    affectedRecordTypes: [...affected],
  };
}

export function describePurgeScope(
  ownedIndexPath: string,
  requestedPath: string,
): { readonly allowed: boolean; readonly reason: string } {
  const allowed = requestedPath === ownedIndexPath;
  return {
    allowed,
    reason: allowed
      ? "exact Fuzit-owned index directory"
      : "refusing to purge outside the exact Fuzit-owned index directory",
  };
}
