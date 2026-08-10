import { createHash } from "node:crypto";
import { isAbsolute, join, normalize } from "node:path";

import {
  LOCAL_INDEX_SCHEMA_VERSION,
  localIndexStatusSchema,
  type LocalIndexStatus,
} from "@fuzit/schemas";

export interface LocalIndexLocationInput {
  readonly cacheHome: string;
  /**
   * A stable repository fingerprint obtained from canonical Git identity.
   * Callers must not use the repository's current absolute path when a stable
   * Git identity is available.
   */
  readonly repositoryFingerprint: string;
}

export type LocalIndexObservedState =
  | { readonly kind: "absent" }
  | { readonly kind: "ready"; readonly schemaVersion: number }
  | { readonly kind: "locked"; readonly lockOwner: string }
  | { readonly kind: "schema-mismatch"; readonly schemaVersion: number }
  | { readonly kind: "repository-mismatch" }
  | { readonly kind: "corrupt" };

export const LOCAL_INDEX_CONTRACT = Object.freeze({
  schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
  ownership: "one-repository-per-directory",
  rebuildPolicy: "discard-and-rebuild-from-authoritative-local-sources",
  lockSemantics: "single-exclusive-writer-multiple-readers",
  privacy: "hashed-repository-identity-no-source-paths-in-cache-location",
});

export function createRepositoryId(repositoryFingerprint: string): string {
  if (repositoryFingerprint.trim().length === 0) {
    throw new Error("Repository fingerprint must not be empty.");
  }

  return `sha256:${createHash("sha256")
    .update(repositoryFingerprint.normalize("NFC"), "utf8")
    .digest("hex")}`;
}

export function getLocalIndexPath(input: LocalIndexLocationInput): string {
  if (!isAbsolute(input.cacheHome)) {
    throw new Error("Cache home must be an absolute path.");
  }

  const repositoryId = createRepositoryId(input.repositoryFingerprint);
  return normalize(
    join(
      input.cacheHome,
      "fuzit",
      "indexes",
      `v${LOCAL_INDEX_SCHEMA_VERSION}`,
      repositoryId.slice("sha256:".length),
    ),
  );
}

export function getLocalIndexStatus(
  input: LocalIndexLocationInput,
  observed: LocalIndexObservedState = { kind: "absent" },
): LocalIndexStatus {
  const repositoryId = createRepositoryId(input.repositoryFingerprint);
  const schemaMismatch =
    observed.kind === "schema-mismatch" ||
    (observed.kind === "ready" &&
      observed.schemaVersion !== LOCAL_INDEX_SCHEMA_VERSION);
  const state = schemaMismatch ? "schema-mismatch" : observed.kind;

  return localIndexStatusSchema.parse({
    schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
    repositoryId,
    path: getLocalIndexPath(input),
    state,
    rebuildRequired:
      schemaMismatch ||
      observed.kind === "repository-mismatch" ||
      observed.kind === "corrupt",
    lockOwner: observed.kind === "locked" ? observed.lockOwner : null,
  });
}
