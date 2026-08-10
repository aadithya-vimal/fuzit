import { describe, it, expect } from "vitest";
import { inferRemoteFromGitConfig } from "@fuzit/git";

describe("GH-023: Ergonomic PR-Number Workflows & Remote Inference", () => {
  it("infers owner and repo from local origin git remote", () => {
    const res = inferRemoteFromGitConfig([
      { name: "origin", url: "https://github.com/myorg/myrepo.git" },
    ]);
    expect(res).toEqual({ owner: "myorg", repo: "myrepo" });
  });
});
