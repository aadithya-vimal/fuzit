import { LOCAL_INDEX_SCHEMA_VERSION } from "@fuzit/schemas";

export type MigrationAction =
  | { readonly kind: "compatible"; readonly schemaVersion: number }
  | {
      readonly kind: "migrated";
      readonly fromVersion: number;
      readonly toVersion: number;
    }
  | {
      readonly kind: "rebuild-required";
      readonly reason: string;
      readonly fromVersion: number | null;
    }
  | {
      readonly kind: "unsupported-future-version";
      readonly schemaVersion: number;
      readonly reason: string;
    };

export interface MigrationEvaluationOptions {
  readonly storedSchemaVersion: number | null;
  readonly supportedVersions?: readonly number[] | undefined;
}

export function evaluateIndexMigration(
  options: MigrationEvaluationOptions,
): MigrationAction {
  const {
    storedSchemaVersion,
    supportedVersions = [LOCAL_INDEX_SCHEMA_VERSION],
  } = options;

  if (storedSchemaVersion === null || typeof storedSchemaVersion !== "number") {
    return {
      kind: "rebuild-required",
      reason: "Missing or invalid schema version in index metadata",
      fromVersion: null,
    };
  }

  if (storedSchemaVersion === LOCAL_INDEX_SCHEMA_VERSION) {
    return {
      kind: "compatible",
      schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
    };
  }

  if (storedSchemaVersion > LOCAL_INDEX_SCHEMA_VERSION) {
    return {
      kind: "unsupported-future-version",
      schemaVersion: storedSchemaVersion,
      reason: `Index schema version ${storedSchemaVersion} is newer than maximum supported version ${LOCAL_INDEX_SCHEMA_VERSION}. Writing or converting this format is refused for safety.`,
    };
  }

  if (supportedVersions.includes(storedSchemaVersion)) {
    return {
      kind: "migrated",
      fromVersion: storedSchemaVersion,
      toVersion: LOCAL_INDEX_SCHEMA_VERSION,
    };
  }

  return {
    kind: "rebuild-required",
    reason: `Schema version ${storedSchemaVersion} is obsolete and cannot be migrated automatically; rebuild is required.`,
    fromVersion: storedSchemaVersion,
  };
}
