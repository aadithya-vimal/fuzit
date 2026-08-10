import { describe, expect, it } from "vitest";
import { createJavaGoReport, javaGoChecks } from "./clean-room-java-go.mjs";

const valid = {
  commit: "a".repeat(40),
  results: javaGoChecks.map((id) => ({ id, status: "passed" })),
};

describe("Java/Go clean-room report", () => {
  it("keeps support claims bounded and partial diagnostics explicit", () =>
    expect(createJavaGoReport(valid)).toMatchObject({
      status: "passed",
      claims: "bounded-static-analysis",
      toolchainExecution: "none",
      graphCompleteness: "partial-when-diagnostic-present",
      failures: 0,
      skips: 0,
    }));

  it("rejects incomplete evidence", () =>
    expect(() =>
      createJavaGoReport({ ...valid, results: valid.results.slice(1) }),
    ).toThrow(/missing/));
});
