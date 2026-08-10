import { describe, expect, it } from "vitest";

import { planReleaseRollback } from "./release-rollback.mjs";

describe("V1 rollback tabletop", () => {
  it("plans a defective package rollback without unpublishing or deleting repositories", () => {
    const plan = planReleaseRollback({
      incidentId: "INC-SYNTHETIC-001",
      defectiveVersion: "1.0.0",
      affectedSurfaces: ["npm", "repository", "docs", "vscode", "npm"],
      schemaChanged: false,
    });
    expect(plan.affectedSurfaces).toEqual([
      "docs",
      "npm",
      "repository",
      "vscode",
    ]);
    expect(plan.repositoryDeletionPermitted).toBe(false);
    expect(plan.historyRewritePermitted).toBe(false);
    expect(plan.publicationActions).toEqual([]);
    expect(plan.steps.map(({ action }) => action)).toContain(
      "deprecate-defective-version-and-select-prior-verified-package",
    );
  });

  it("plans schema recovery only against derived state", () => {
    const plan = planReleaseRollback({
      incidentId: "INC-SYNTHETIC-002",
      defectiveVersion: "1.0.1",
      affectedSurfaces: ["npm"],
      schemaChanged: true,
    });
    expect(plan.userConfigurationDeletionPermitted).toBe(false);
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        owner: "data-owner",
        action: "verify-purge-and-rebuild-derived-index-with-compatible-cli",
        mutation: "derived-state-only",
      }),
    );
  });

  it("fails closed for incomplete or unknown incidents", () => {
    expect(() => planReleaseRollback({ affectedSurfaces: [] })).toThrow(
      "incidentId and defectiveVersion",
    );
    expect(() =>
      planReleaseRollback({
        incidentId: "INC-SYNTHETIC-003",
        defectiveVersion: "1.0.2",
        affectedSurfaces: ["database"],
      }),
    ).toThrow("unsupported rollback surface");
  });
});
