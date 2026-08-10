import { describe, it, expect } from "vitest";
import { normalizeCheckRun, normalizeCommitStatus } from "@fuzit/provider-github";

describe("GH-018: Ingest Checks and Commit Statuses", () => {
  it("normalizes check run and commit status payload", () => {
    const host = { webHost: "github.com", apiHost: "api.github.com", isEnterprise: false };

    const check = normalizeCheckRun(host, "owner/repo", {
      id: 55,
      head_sha: "abc",
      name: "build",
      status: "completed",
      conclusion: "success",
    });
    expect(check.name).toBe("build");
    expect(check.conclusion).toBe("success");

    const status = normalizeCommitStatus(host, "owner/repo", {
      id: 99,
      sha: "abc",
      context: "ci/travis",
      state: "success",
    });
    expect(status.context).toBe("ci/travis");
    expect(status.state).toBe("success");
  });
});
