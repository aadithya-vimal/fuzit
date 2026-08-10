import { describe, expect, it } from "vitest";

import { parseDiagnostic, serializeDiagnostic } from "../src/diagnostic.js";

describe("diagnostic contracts", () => {
  it("parses a valid diagnostic", () => {
    expect(
      parseDiagnostic({
        schemaVersion: 1,
        code: "CONFIG.INVALID",
        severity: "error",
        source: "config",
        message: "Configuration is invalid.",
        remediation: "Correct the configuration value.",
        location: {
          path: "fuzit.config.json",
          line: 3,
          column: 5,
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      code: "CONFIG.INVALID",
      severity: "error",
      source: "config",
      message: "Configuration is invalid.",
      remediation: "Correct the configuration value.",
      location: {
        path: "fuzit.config.json",
        line: 3,
        column: 5,
      },
    });
  });

  it("rejects an invalid severity", () => {
    expect(() =>
      parseDiagnostic({
        schemaVersion: 1,
        code: "CONFIG.INVALID",
        severity: "critical",
        source: "config",
        message: "Configuration is invalid.",
      }),
    ).toThrow();
  });

  it("serializes deterministically without adding timestamps", () => {
    const diagnostic = parseDiagnostic({
      schemaVersion: 1,
      code: "SOURCE.PARTIAL",
      severity: "warning",
      source: "repository",
      message: "One optional source was unavailable.",
    });

    expect(serializeDiagnostic(diagnostic)).toBe(
      '{"schemaVersion":1,"code":"SOURCE.PARTIAL","severity":"warning","source":"repository","message":"One optional source was unavailable."}',
    );
    expect(serializeDiagnostic(diagnostic)).toBe(
      serializeDiagnostic(diagnostic),
    );
    expect(serializeDiagnostic(diagnostic)).not.toContain("timestamp");
  });
});
