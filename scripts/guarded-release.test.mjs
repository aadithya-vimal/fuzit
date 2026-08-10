import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  evaluateReleaseAuthorization,
  executeGuardedPlan,
  materializeReleasePlan,
} from "./guarded-release.mjs";

const head = "a".repeat(40);
const version = "1.0.0";
const branch = "release/v1.0.0";
const approval = {
  publicationAuthorized: true,
  releaseAuthorization: {
    approvedSourceCommit: head,
    approvedVersion: version,
    approvedBranch: branch,
  },
};
const credentials = {
  FUZIT_RELEASE_AUTHORIZATION: `publish:${version}:${head}`,
  NPM_TOKEN: "present",
  VSCE_PAT: "present",
  GITHUB_TOKEN: "present",
};

describe("guarded local release", () => {
  it("blocks normal sprint state before inspecting credentials", () => {
    const decision = evaluateReleaseAuthorization({
      state: { publicationAuthorized: false },
      environment: {},
      head,
      version,
      branch,
    });
    expect(decision.status).toBe("blocked");
    expect(decision.publicationActionsPermitted).toBe(false);
    expect(decision.reasons).toContain("publicationAuthorized is not true");
  });

  it("requires matching owner scope, all credentials, and a clean tree", () => {
    const decision = evaluateReleaseAuthorization({
      state: approval,
      environment: credentials,
      head,
      version,
      branch,
      dirtyPaths: ["owner-file.txt"],
    });
    expect(decision.status).toBe("blocked");
    expect(decision.reasons).toEqual(["working tree is not clean"]);
  });

  it("materializes a deterministic local plan with explicit mutation phases", () => {
    const first = materializeReleasePlan({ version, commit: head });
    expect(materializeReleasePlan({ version, commit: head })).toEqual(first);
    expect(first.map(({ phase }) => phase)).toEqual([
      "gate",
      "gate",
      "gate",
      "publish",
      "publish",
      "publish",
      "publish",
      "tag",
      "release",
    ]);
    expect(first.at(-2)?.arguments).toContain(`v${version}`);
    expect(first.at(-2)?.arguments).toContain(head);
  });

  it("cannot execute any step with a blocked decision", () => {
    let invoked = false;
    expect(() =>
      executeGuardedPlan({
        decision: { status: "blocked", publicationActionsPermitted: false },
        plan: materializeReleasePlan({ version, commit: head }),
        execute: () => {
          invoked = true;
          return { status: 0 };
        },
      }),
    ).toThrow("not authorized");
    expect(invoked).toBe(false);
  });

  it("normal CLI invocation is blocked with zero actions", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/guarded-release.mjs"],
      {
        encoding: "utf8",
        env: { ...process.env, FUZIT_RELEASE_AUTHORIZATION: "" },
      },
    );
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      gate: "release:guarded",
      executeRequested: false,
      actionsExecuted: [],
      decision: { status: "blocked", publicationActionsPermitted: false },
    });
  });
});
