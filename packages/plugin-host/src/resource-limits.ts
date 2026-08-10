import type { Diagnostic } from "@fuzit/plugin-sdk";

export interface PluginResourceLimits {
  readonly maxOutputBytes?: number;
  readonly maxDiagnosticsPerRequest?: number;
  readonly maxRequestsPerMinute?: number;
  readonly startupTimeoutMs?: number;
  readonly requestTimeoutMs?: number;
  readonly maxStderrBytes?: number;
}

export const DEFAULT_PLUGIN_RESOURCE_LIMITS: Required<PluginResourceLimits> = {
  maxOutputBytes: 16 * 1024 * 1024, // 16MB
  maxDiagnosticsPerRequest: 100,
  maxRequestsPerMinute: 600,
  startupTimeoutMs: 5000,
  requestTimeoutMs: 10000,
  maxStderrBytes: 1024 * 1024, // 1MB
};

/**
 * Truncates diagnostic array if it exceeds maxDiagnosticsPerRequest and appends a truncation warning.
 */
export function enforceDiagnosticLimits(
  diagnostics: readonly Diagnostic[] | undefined,
  maxDiagnostics: number = DEFAULT_PLUGIN_RESOURCE_LIMITS.maxDiagnosticsPerRequest,
): readonly Diagnostic[] | undefined {
  if (!diagnostics || diagnostics.length <= maxDiagnostics) {
    return diagnostics;
  }

  const truncated = diagnostics.slice(0, maxDiagnostics - 1);
  const warning: Diagnostic = {
    schemaVersion: 1,
    code: "PLUGIN_DIAGNOSTIC_TRUNCATED",
    severity: "warning",
    source: "plugin-host",
    message: `Diagnostic list truncated: exceeded max limit of ${maxDiagnostics} diagnostics per request.`,
  };

  return [...truncated, warning];
}
