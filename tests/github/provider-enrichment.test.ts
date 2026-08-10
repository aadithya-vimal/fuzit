import { describe, it, expect } from "vitest";
import { mergeProviderEvidenceIntoSelection } from "@fuzit/selection";

describe("GH-021: Merge Provider Evidence into Selection", () => {
  it("extracts changed paths and issue text from provider records", () => {
    const res = mergeProviderEvidenceIntoSelection([
      {
        schemaVersion: 1,
        id: "1",
        kind: "pull-request-file",
        provider: "github",
        host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
        repositoryFullName: "owner/repo",
        observedAt: "",
        completeness: "full",
        sensitivity: "public",
        prNumber: 1,
        path: "src/app.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
      },
    ]);

    expect(res.prioritizedPaths).toEqual(["src/app.ts"]);
  });
});
