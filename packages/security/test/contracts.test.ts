import { describe, expect, it } from "vitest";

import {
  findingSchema,
  policyDecisionSchema,
  type SecurityFinding,
} from "@fuzit/schemas";

import { securityFindingDiagnostic } from "../src/index.js";

const fingerprint = "a".repeat(64);

function finding(id: string, start: number, end: number): SecurityFinding {
  return findingSchema.parse({
    schemaVersion: 1,
    id,
    kind: "credential",
    path: "src/example.ts",
    span: { start, end },
    fingerprint,
    sensitivity: "restricted",
    confidence: 0.9,
  });
}

describe("security contracts", () => {
  it("preserves finding spans and multiple findings", () => {
    const findings = [finding("one", 1, 5), finding("two", 8, 12)];
    expect(findings.map(({ span }) => span)).toEqual([
      { start: 1, end: 5 },
      { start: 8, end: 12 },
    ]);
  });

  it("serializes policy decisions", () => {
    const decision = policyDecisionSchema.parse({
      schemaVersion: 1,
      action: "omit",
      reason: "Binary or omitted content cannot be inspected.",
      findingIds: [],
    });
    expect(JSON.parse(JSON.stringify(decision))).toEqual(decision);
  });

  it("does not include a raw secret in diagnostics", () => {
    const secret = "super-secret-token";
    const diagnostic = securityFindingDiagnostic(finding("one", 0, 18));
    expect(JSON.stringify(diagnostic)).not.toContain(secret);
  });
});
