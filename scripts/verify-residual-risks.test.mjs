import { describe, expect, it } from "vitest";
import register from "../docs/release/residual-risks.json" with { type: "json" };
import { validateResidualRisks } from "./verify-residual-risks.mjs";

const clone = () => JSON.parse(JSON.stringify(register));
describe("residual risk register", () => {
  it("classifies every warning with no open blockers", () =>
    expect(validateResidualRisks(register)).toMatchObject({
      status: "reviewed-ready",
      riskCount: 10,
      openBlockers: [],
    }));
  it("rejects ignored evidence and false readiness", () => {
    const blank = clone();
    blank.risks[0].evidence = [];
    expect(() => validateResidualRisks(blank)).toThrow(/evidence is blank/);
    const falselyReady = clone();
    falselyReady.risks[0].status = "open";
    falselyReady.risks[0].releaseBlocking = true;
    expect(() => validateResidualRisks(falselyReady)).toThrow(
      /reviewed-blocked/,
    );
  });
});
