import { describe, expect, it } from "vitest";
import {
  sanitizedEnvironment,
  verifyBlockedDryRun,
} from "./verify-guarded-workflow.mjs";

const state = {
  head: "a".repeat(40),
  branch: "v1-completion",
  tags: "",
  remotes: "origin x (fetch)",
  status: "?? owner.txt",
};
const output = {
  gate: "release:guarded",
  executeRequested: false,
  actionsExecuted: [],
  decision: { status: "blocked", publicationActionsPermitted: false },
};

describe("guarded workflow dry-run audit", () => {
  it("proves a blocked invocation leaves Git and remote state unchanged", () => {
    expect(
      verifyBlockedDryRun({
        before: state,
        after: { ...state },
        exitCode: 1,
        output,
      }),
    ).toMatchObject({
      status: "passed",
      actionsExecuted: [],
      gitState: "unchanged",
    });
  });

  it("fails if a tag, remote, tree path, or action changes", () => {
    expect(() =>
      verifyBlockedDryRun({
        before: state,
        after: { ...state, tags: "v1.0.0" },
        exitCode: 1,
        output,
      }),
    ).toThrow(/tags changed/);
    expect(() =>
      verifyBlockedDryRun({
        before: state,
        after: state,
        exitCode: 1,
        output: { ...output, actionsExecuted: ["publish"] },
      }),
    ).toThrow(/actions were executed/);
  });

  it("removes publication credentials and authorization", () => {
    const environment = sanitizedEnvironment({
      NPM_TOKEN: "secret",
      VSCE_PAT: "secret",
      GITHUB_TOKEN: "secret",
      SAFE: "yes",
    });
    expect(environment).toEqual({
      FUZIT_RELEASE_AUTHORIZATION: "",
      SAFE: "yes",
    });
  });
});
