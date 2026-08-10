import { describe, it, expect } from "vitest";
import { buildStableRecordId, PROVIDER_RECORDS_SCHEMA_VERSION, type PullRequestRecord } from "@fuzit/schemas";

describe("GH-009: Normalized Provider Records", () => {
  it("generates stable record IDs independent of observation time", () => {
    const id1 = buildStableRecordId("github", "github.com", "owner/repo", "pull-request", 123);
    const id2 = buildStableRecordId("github", "github.com", "OWNER/REPO", "pull-request", 123);
    expect(id1).toBe(id2);
    expect(id1).toBe("github:github.com:owner/repo:pull-request:123");
  });

  it("constructs valid PullRequestRecord conforming to schema", () => {
    const record: PullRequestRecord = {
      schemaVersion: PROVIDER_RECORDS_SCHEMA_VERSION,
      id: buildStableRecordId("github", "github.com", "owner/repo", "pull-request", 123),
      kind: "pull-request",
      provider: "github",
      host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
      repositoryFullName: "owner/repo",
      observedAt: "2026-08-04T00:00:00.000Z",
      completeness: "full",
      sensitivity: "public",
      number: 123,
      title: "Feature",
      body: "Description",
      state: "open",
      isDraft: false,
      authorLogin: "alice",
      baseRef: "main",
      baseSha: "1111111111111111111111111111111111111111",
      headRef: "feat",
      headSha: "2222222222222222222222222222222222222222",
      labels: ["enhancement"],
    };

    expect(record.schemaVersion).toBe(1);
    expect(record.kind).toBe("pull-request");
    expect(record.number).toBe(123);
  });
});
