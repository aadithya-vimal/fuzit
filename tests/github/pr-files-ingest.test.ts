import { describe, it, expect } from "vitest";
import { normalizePrFile } from "@fuzit/provider-github";

describe("GH-016: Ingest Pull Request Files and Patches", () => {
  it("normalizes PR file and truncates oversized patch", () => {
    const { fileRecord, patchRecord } = normalizePrFile(
      {
        kind: "github-pull-request",
        host: { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false },
        owner: "owner",
        repo: "repo",
        number: 42,
      },
      {
        filename: "src/main.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        patch: "@@ -1,2 +1,10 @@\n+const x = 1;",
      },
      20
    );

    expect(fileRecord.path).toBe("src/main.ts");
    expect(fileRecord.status).toBe("modified");
    expect(patchRecord).toBeDefined();
    expect(patchRecord?.isTruncated).toBe(true);
    expect(patchRecord?.patchContent.length).toBe(20);
  });
});
