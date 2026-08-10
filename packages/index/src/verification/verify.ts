import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { LOCAL_INDEX_SCHEMA_VERSION } from "@fuzit/schemas";
import {
  evaluateInvalidation,
  type IndexSemanticVersions,
} from "../invalidation/evaluate.js";

export type IndexVerificationStatusKind =
  | "ready"
  | "stale"
  | "incomplete"
  | "corrupt"
  | "schema-mismatch"
  | "repository-mismatch"
  | "policy-mismatch"
  | "rebuild-required"
  | "absent"
  | "locked";

export interface IndexVerificationResult {
  readonly status: IndexVerificationStatusKind;
  readonly valid: boolean;
  readonly rebuildRequired: boolean;
  readonly reasons: readonly string[];
  readonly details: {
    readonly schemaVersion: number | null;
    readonly repositoryId: string | null;
    readonly lockOwner: string | null;
  };
}

export interface VerifyIndexOptions {
  readonly indexPath: string;
  readonly expectedRepositoryId: string;
  readonly currentSemanticState?: IndexSemanticVersions | undefined;
}

export async function verifyLocalIndex(
  options: VerifyIndexOptions,
): Promise<IndexVerificationResult> {
  const { indexPath, expectedRepositoryId, currentSemanticState } = options;

  // 1. Check lock
  try {
    await stat(join(indexPath, "index.lock"));
    return {
      status: "locked",
      valid: false,
      rebuildRequired: false,
      reasons: ["index is locked by another process"],
      details: {
        schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
        repositoryId: expectedRepositoryId,
        lockOwner: "local-index-writer",
      },
    };
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      return {
        status: "corrupt",
        valid: false,
        rebuildRequired: true,
        reasons: ["unable to inspect index lock file"],
        details: { schemaVersion: null, repositoryId: null, lockOwner: null },
      };
    }
  }

  // 2. Read index.json metadata
  let metadataRaw: string;
  try {
    metadataRaw = await readFile(join(indexPath, "index.json"), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        status: "absent",
        valid: false,
        rebuildRequired: true,
        reasons: ["index metadata file absent"],
        details: { schemaVersion: null, repositoryId: null, lockOwner: null },
      };
    }
    return {
      status: "corrupt",
      valid: false,
      rebuildRequired: true,
      reasons: ["unable to read index metadata file"],
      details: { schemaVersion: null, repositoryId: null, lockOwner: null },
    };
  }

  let metadata: {
    schemaVersion?: unknown;
    repositoryId?: unknown;
    createdAt?: unknown;
  };
  try {
    metadata = JSON.parse(metadataRaw);
  } catch {
    return {
      status: "corrupt",
      valid: false,
      rebuildRequired: true,
      reasons: ["index metadata file is not valid JSON"],
      details: { schemaVersion: null, repositoryId: null, lockOwner: null },
    };
  }

  if (
    typeof metadata.schemaVersion !== "number" ||
    typeof metadata.repositoryId !== "string" ||
    typeof metadata.createdAt !== "string"
  ) {
    return {
      status: "corrupt",
      valid: false,
      rebuildRequired: true,
      reasons: ["index metadata contains malformed or missing fields"],
      details: {
        schemaVersion:
          typeof metadata.schemaVersion === "number"
            ? metadata.schemaVersion
            : null,
        repositoryId:
          typeof metadata.repositoryId === "string"
            ? metadata.repositoryId
            : null,
        lockOwner: null,
      },
    };
  }

  const schemaVersion = metadata.schemaVersion;
  const repositoryId = metadata.repositoryId;

  if (schemaVersion !== LOCAL_INDEX_SCHEMA_VERSION) {
    return {
      status: "schema-mismatch",
      valid: false,
      rebuildRequired: true,
      reasons: [
        `index schema version mismatch: stored ${schemaVersion}, expected ${LOCAL_INDEX_SCHEMA_VERSION}`,
      ],
      details: { schemaVersion, repositoryId, lockOwner: null },
    };
  }

  if (repositoryId !== expectedRepositoryId) {
    return {
      status: "repository-mismatch",
      valid: false,
      rebuildRequired: true,
      reasons: ["index repository identity mismatch"],
      details: { schemaVersion, repositoryId, lockOwner: null },
    };
  }

  // 3. Read semantic.json state
  let semanticRaw: string;
  try {
    semanticRaw = await readFile(join(indexPath, "semantic.json"), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        status: "incomplete",
        valid: false,
        rebuildRequired: true,
        reasons: ["semantic state file absent"],
        details: { schemaVersion, repositoryId, lockOwner: null },
      };
    }
    return {
      status: "corrupt",
      valid: false,
      rebuildRequired: true,
      reasons: ["unable to read semantic state file"],
      details: { schemaVersion, repositoryId, lockOwner: null },
    };
  }

  let storedSemanticState: IndexSemanticVersions;
  try {
    storedSemanticState = JSON.parse(semanticRaw);
  } catch {
    return {
      status: "corrupt",
      valid: false,
      rebuildRequired: true,
      reasons: ["semantic state file is not valid JSON"],
      details: { schemaVersion, repositoryId, lockOwner: null },
    };
  }

  // Check required fields in stored semantic state
  if (
    !storedSemanticState ||
    typeof storedSemanticState.contentHash !== "string" ||
    typeof storedSemanticState.configHash !== "string" ||
    typeof storedSemanticState.scannerVersion !== "string" ||
    typeof storedSemanticState.parserVersion !== "string" ||
    typeof storedSemanticState.securityPolicyVersion !== "string" ||
    typeof storedSemanticState.schemaVersion !== "number"
  ) {
    return {
      status: "corrupt",
      valid: false,
      rebuildRequired: true,
      reasons: ["semantic state contains malformed or missing fields"],
      details: { schemaVersion, repositoryId, lockOwner: null },
    };
  }

  // 4. Compare with current repository state if provided
  if (currentSemanticState) {
    const invalidation = evaluateInvalidation(
      storedSemanticState,
      currentSemanticState,
    );
    if (!invalidation.valid) {
      let status: IndexVerificationStatusKind = "rebuild-required";
      if (
        invalidation.reasons.some(
          (r) => r.includes("securityPolicy") || r.includes("policy"),
        )
      ) {
        status = "policy-mismatch";
      } else if (invalidation.reasons.some((r) => r.includes("contentHash"))) {
        status = "stale";
      }

      return {
        status,
        valid: false,
        rebuildRequired: invalidation.action === "rebuild",
        reasons: invalidation.reasons,
        details: { schemaVersion, repositoryId, lockOwner: null },
      };
    }
  }

  return {
    status: "ready",
    valid: true,
    rebuildRequired: false,
    reasons: [],
    details: { schemaVersion, repositoryId, lockOwner: null },
  };
}
