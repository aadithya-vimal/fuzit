import { describe, expect, it } from "vitest";
import {
  createMonorepoReport,
  monorepoChecks,
} from "./clean-room-monorepo.mjs";

const valid = {
  commit: "a".repeat(40),
  results: monorepoChecks.map((id) => ({ id, status: "passed" })),
};
describe("monorepo clean-room report", () => {
  it("records App Router, boundaries, budget, and resources", () =>
    expect(createMonorepoReport(valid)).toMatchObject({
      status: "passed",
      supportedNextVariant: "App Router",
      crossPackageLeakage: "absent",
      contextBudget: "enforced",
    }));
  it("fails on partial evidence", () =>
    expect(() =>
      createMonorepoReport({ ...valid, results: valid.results.slice(1) }),
    ).toThrow(/missing/));
});
