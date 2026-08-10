import { describe, expect, it } from "vitest";
import { evaluateIndexMigration } from "@fuzit/index";

describe("index migration and rebuild handling", () => {
  it("handles current schema version as compatible", () => {
    const result = evaluateIndexMigration({ storedSchemaVersion: 1 });
    expect(result).toEqual({
      kind: "compatible",
      schemaVersion: 1,
    });
  });

  it("handles legacy/supported older schema version as migrated", () => {
    const result = evaluateIndexMigration({
      storedSchemaVersion: 0,
      supportedVersions: [0, 1],
    });
    expect(result).toEqual({
      kind: "migrated",
      fromVersion: 0,
      toVersion: 1,
    });
  });

  it("handles obsolete older schema version as rebuild required", () => {
    const result = evaluateIndexMigration({
      storedSchemaVersion: -1,
      supportedVersions: [1],
    });
    expect(result.kind).toBe("rebuild-required");
    if (result.kind === "rebuild-required") {
      expect(result.fromVersion).toBe(-1);
      expect(result.reason).toContain("obsolete");
    }
  });

  it("handles unknown future schema version with write prohibition", () => {
    const result = evaluateIndexMigration({ storedSchemaVersion: 2 });
    expect(result.kind).toBe("unsupported-future-version");
    if (result.kind === "unsupported-future-version") {
      expect(result.schemaVersion).toBe(2);
      expect(result.reason).toContain("newer than maximum supported version");
    }
  });

  it("handles corrupt or null schema version as rebuild required", () => {
    const result = evaluateIndexMigration({ storedSchemaVersion: null });
    expect(result).toEqual({
      kind: "rebuild-required",
      reason: "Missing or invalid schema version in index metadata",
      fromVersion: null,
    });
  });
});
