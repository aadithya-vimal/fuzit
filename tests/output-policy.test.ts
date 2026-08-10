import { describe, expect, it } from "vitest";

import { createOutputRouter } from "../apps/cli/src/output/router.js";
import type { Diagnostic } from "../packages/schemas/src/diagnostic.js";
import {
  EXIT_CODES,
  exitCodeSchema,
} from "../packages/schemas/src/exit-code.js";

const diagnostic: Diagnostic = {
  schemaVersion: 1,
  code: "CLI.TEST",
  severity: "error",
  source: "test",
  message: "Operation failed.",
};

function captureOutput(options: {
  readonly debug: boolean;
  readonly json: boolean;
  readonly quiet: boolean;
}) {
  let stdout = "";
  let stderr = "";
  const router = createOutputRouter(
    {
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
    },
    options,
  );

  return {
    router,
    read: () => ({ stderr, stdout }),
  };
}

describe("exit code and output policy", () => {
  it("defines every documented exit code", () => {
    expect(EXIT_CODES).toEqual({
      success: 0,
      validation: 2,
      environment: 3,
      partial: 4,
      internal: 70,
      cancelled: 130,
    });

    for (const exitCode of Object.values(EXIT_CODES)) {
      expect(exitCodeSchema.parse(exitCode)).toBe(exitCode);
    }
  });

  it("keeps JSON on stdout without ANSI", () => {
    const output = captureOutput({ debug: false, json: true, quiet: false });

    output.router.writeDiagnostic(diagnostic);

    const captured = output.read();
    expect(captured.stderr).toBe("");
    expect(JSON.parse(captured.stdout)).toEqual({
      schemaVersion: 1,
      diagnostics: [diagnostic],
    });
    expect(captured.stdout).not.toContain("\u001B[");
  });

  it("writes stack traces only in debug mode", () => {
    const hidden = captureOutput({ debug: false, json: false, quiet: false });
    const visible = captureOutput({ debug: true, json: false, quiet: false });
    const cause = new Error("debug detail");

    hidden.router.writeDiagnostic(diagnostic, cause);
    visible.router.writeDiagnostic(diagnostic, cause);

    expect(hidden.read().stderr).not.toContain("debug detail");
    expect(visible.read().stderr).toContain("debug detail");
  });

  it("redacts secret-like strings from errors and debug stacks", () => {
    const output = captureOutput({ debug: true, json: false, quiet: false });
    const secret = `ghp_${"a".repeat(36)}`;
    const cause = new Error(`password=hunter2 token=${secret}`);

    output.router.writeDiagnostic(
      {
        ...diagnostic,
        message: `token=${secret}`,
      },
      cause,
    );

    expect(output.read().stderr).not.toContain(secret);
    expect(output.read().stderr).not.toContain("hunter2");
    expect(output.read().stderr).toContain("[REDACTED]");
  });
});
