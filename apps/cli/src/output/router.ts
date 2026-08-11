import type { Diagnostic } from "@fuzit/schemas";

import { redactSensitiveText } from "./redact.js";
import { formatHumanValue } from "./presentation.js";

export interface OutputIo {
  readonly writeOut: (value: string) => void;
  readonly writeErr: (value: string) => void;
}

export interface OutputOptions {
  readonly debug: boolean;
  readonly json: boolean;
  readonly quiet: boolean;
}

function redactDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    ...diagnostic,
    source: redactSensitiveText(diagnostic.source),
    message: redactSensitiveText(diagnostic.message),
    ...(diagnostic.remediation
      ? { remediation: redactSensitiveText(diagnostic.remediation) }
      : {}),
    ...(diagnostic.location
      ? {
          location: {
            ...diagnostic.location,
            path: redactSensitiveText(diagnostic.location.path),
          },
        }
      : {}),
  };
}

export function createOutputRouter(io: OutputIo, options: OutputOptions) {
  return {
    writeActivity(value: string): void {
      if (options.json || options.quiet) return;
      io.writeErr(`${redactSensitiveText(value)}\n`);
    },

    writeData(value: unknown): void {
      if (options.json) {
        io.writeOut(`${JSON.stringify(value)}\n`);
      } else if (typeof value === "string") {
        io.writeOut(value.endsWith("\n") ? value : `${value}\n`);
      } else {
        const formatted = formatHumanValue(value);
        io.writeOut(`${formatted ?? JSON.stringify(value, null, 2)}\n`);
      }
    },

    writeDiagnostic(diagnostic: Diagnostic, cause?: unknown): void {
      const safeDiagnostic = redactDiagnostic(diagnostic);

      if (options.json) {
        io.writeOut(
          `${JSON.stringify({
            schemaVersion: 1,
            diagnostics: [safeDiagnostic],
          })}\n`,
        );
        return;
      }

      if (options.quiet && safeDiagnostic.severity === "info") {
        return;
      }

      io.writeErr(
        `${safeDiagnostic.severity} ${safeDiagnostic.code}: ${safeDiagnostic.message}\n`,
      );

      if (options.debug && cause instanceof Error && cause.stack) {
        io.writeErr(`${redactSensitiveText(cause.stack)}\n`);
      }
    },
  };
}
