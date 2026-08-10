import { describe, expect, it } from "vitest";
import { finalAuditPlan, runFinalAudits } from "./final-audits.mjs";

describe("final frozen-candidate audits", () => {
  it("keeps every mandatory audit in stable order", () => {
    expect(finalAuditPlan.map(([id]) => id)).toEqual([
      "secrets",
      "adversarial",
      "network-privacy",
      "plugins",
      "mcp",
      "extension",
      "history",
      "dependencies-licenses",
      "sbom",
      "artifacts",
    ]);
  });

  it("fails deterministically on a nonzero audit or high finding", () => {
    const run = ([id]) => ({
      status: id === "history" ? 3 : 0,
      durationMs: 1,
      findings:
        id === "secrets" ? [{ severity: "high", fingerprint: "fixture" }] : [],
    });
    const first = runFinalAudits({ run });
    expect(runFinalAudits({ run })).toEqual(first);
    expect(first.status).toBe("failed");
    expect(first.criticalOrHighFindings).toBe(1);
    expect(first.results.find(({ id }) => id === "history")?.exitCode).toBe(3);
  });

  it("passes only when every audit passes without high findings", () => {
    expect(
      runFinalAudits({ run: () => ({ status: 0, durationMs: 2 }) }),
    ).toMatchObject({ status: "passed", criticalOrHighFindings: 0 });
  });
});
