import { describe, expect, it } from "vitest";
import {
  createSelectionReport,
  explainPath,
  formatSelectionExplanation,
  renderSelectionExplanation,
  renderSelectionFailure,
  type SelectionOutcome,
} from "../src/index.js";

describe("selection explanations", () => {
  it.each([
    "included",
    "excluded",
    "redacted",
    "truncated",
    "dependency-expanded",
    "failed-source",
  ] satisfies SelectionOutcome[])("preserves %s evidence", (outcome) => {
    const evidence = {
      path: `${outcome}.ts`,
      outcome,
      reason: `algorithm marked ${outcome}`,
      profile: "bug-fix",
      contributions: { lexical: 2, git: 1 },
      budgetTokens: outcome === "excluded" ? 40 : undefined,
    };
    const report = createSelectionReport([evidence]);
    expect(explainPath(report, evidence.path)).toEqual(evidence);
    expect(formatSelectionExplanation(evidence)).toContain(evidence.reason);
  });

  it("preserves deterministic tie-break evidence", () => {
    const evidence = {
      path: "a.ts",
      outcome: "included" as const,
      reason: "equal score",
      tieBreak: "canonical path ascending",
    };
    expect(formatSelectionExplanation(evidence)).toContain(
      "canonical path ascending",
    );
  });

  const completeEvidence = {
    path: "src/a.ts",
    outcome: "dependency-expanded" as const,
    reason: "resolved dependency",
    profile: "architecture-review",
    contributions: { dependency: 0.8 },
    profileWeights: { dependency: 4 },
    aggregateScore: 3.2,
    graphPath: ["src/root.ts", "dependency:src/a.ts"],
    lifecycle: { basis: "imported by src/root.ts", confidence: "medium" },
    expansionReason: "approved dependency edge",
    budgetDecision: "included within 400 tokens",
    indexState: "ready schema 1",
    securityDecision: "allowed after policy filter",
  };

  it.each(["json", "markdown", "text", "xml", "debug"] as const)(
    "renders complete safe %s evidence deterministically",
    (format) => {
      const output = renderSelectionExplanation(completeEvidence, format);
      expect(output).toBe(renderSelectionExplanation(completeEvidence, format));
      expect(output).toContain("dependency");
      expect(output).toContain("architecture-review");
      expect(output).toContain("ready schema 1");
    },
  );

  it("redacts secrets and unsafe absolute paths in every mode and failures", () => {
    const unsafe = {
      ...completeEvidence,
      path: "C:\\Users\\owner\\secret.ts",
      reason: "token=super-secret from /home/owner/private.ts",
    };
    for (const format of [
      "json",
      "markdown",
      "text",
      "xml",
      "debug",
    ] as const) {
      const output = renderSelectionExplanation(unsafe, format);
      expect(output).not.toContain("super-secret");
      expect(output).not.toContain("owner");
    }
    const failure = renderSelectionFailure(
      new Error("password=hunter2 at /tmp/private.txt"),
      "debug",
    );
    expect(failure).not.toContain("hunter2");
    expect(failure).not.toContain("/tmp/private.txt");
  });
});
