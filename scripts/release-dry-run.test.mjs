import { describe, expect, it } from "vitest";

import {
  assertSafeReleasePlan,
  executeReleasePlan,
  releaseDryRunPlan,
} from "./release-dry-run.mjs";

describe("release dry-run", () => {
  it("uses a deterministic version, build, pack verification, and docs plan", () => {
    expect(releaseDryRunPlan.map(({ id }) => id)).toEqual([
      "install",
      "build",
      "pack-and-verify",
      "docs-build",
      "docs-check",
      "docs-tests",
    ]);
    expect(assertSafeReleasePlan(releaseDryRunPlan)).toBe(releaseDryRunPlan);
  });

  it("stops after a failed mandatory step and reports the partial result", () => {
    const invoked = [];
    const result = executeReleasePlan(releaseDryRunPlan, ({ id }) => {
      invoked.push(id);
      return { status: id === "build" ? 2 : 0 };
    });
    expect(result.status).toBe("failed");
    expect(invoked).toEqual(["install", "build"]);
    expect(result.results.at(-1)).toMatchObject({
      status: "failed",
      exitCode: 2,
    });
  });

  it("rejects any registry or Git publication mutation", () => {
    expect(() =>
      assertSafeReleasePlan([
        { id: "bad", command: "pnpm", arguments: ["publish"] },
      ]),
    ).toThrow("forbids mutation command");
    expect(() =>
      assertSafeReleasePlan([
        { id: "bad", command: "git", arguments: ["tag", "v1"] },
      ]),
    ).toThrow("forbids mutation command");
  });
});
