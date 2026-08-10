import type { Diagnostic, SecurityFinding } from "@fuzit/schemas";

export * from "./path-policy/index.js";
export * from "./detectors/index.js";
export * from "./redaction/index.js";

export function securityFindingDiagnostic(
  finding: SecurityFinding,
): Diagnostic {
  return {
    schemaVersion: 1,
    code: "SECURITY.FINDING",
    severity: "warning",
    source: "security",
    message: `Sensitive ${finding.kind} detected (${finding.fingerprint.slice(0, 12)}).`,
    location: {
      path: finding.path,
      line: 1,
      column: finding.span.start + 1,
    },
  };
}
