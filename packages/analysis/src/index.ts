import { createHash } from "node:crypto";

import {
  repositoryFactSchema,
  type RepositoryFact,
  type RepositoryFactKind,
} from "@fuzit/schemas";

export * from "./languages/index.js";
export * from "./manifests/js/index.js";
export * from "./manifests/python/index.js";
export * from "./manifests/java/index.js";
export * from "./manifests/go/index.js";
export * from "./detectors/index.js";
export * from "./dependencies/index.js";
export * from "./contracts/index.js";
export * from "./parsers/index.js";
export * from "./relations/index.js";
export * from "./availability/index.js";

export type RepositoryFactInput = Omit<RepositoryFact, "schemaVersion" | "id">;

export function createRepositoryFact(
  input: RepositoryFactInput,
): RepositoryFact {
  const identity = JSON.stringify({
    kind: input.kind,
    value: input.value,
    detector: input.detector,
    evidence: input.evidence,
  });
  return repositoryFactSchema.parse({
    ...input,
    schemaVersion: 1,
    id: `fact:${createHash("sha256").update(identity).digest("hex")}`,
  });
}

export function conflictingFacts(
  facts: readonly RepositoryFact[],
  kind: RepositoryFactKind,
): RepositoryFact[] {
  return facts.filter(
    (fact) => fact.kind === kind && fact.conflictsWith.length > 0,
  );
}
