import { runDoctor } from "@fuzit/core";
import { BUILT_IN_PROFILES } from "@fuzit/profiles";

import { type McpCallContext, runTool, validateRoot } from "../tool-runner.js";

/**
 * fuzit_status — returns doctor report equivalent to CLI doctor --json.
 * All absolute paths and environment-specific metadata are redacted.
 */
export async function fuzitStatus(
  root: unknown,
  context: McpCallContext,
): Promise<ReturnType<typeof runTool>> {
  return runTool(async () => {
    const validRoot = await validateRoot(root, context);
    const report = await runDoctor(validRoot);
    // Redact any absolute paths that may appear in check metadata
    const redactedChecks = report.checks.map((check) => ({
      ...check,
      metadata: check.metadata
        ? Object.fromEntries(
            Object.entries(check.metadata).map(([k, v]) => [
              k,
              typeof v === "string" && v.includes(validRoot)
                ? v.replaceAll(validRoot, "<root>")
                : v,
            ]),
          )
        : undefined,
    }));
    return { ...report, checks: redactedChecks };
  });
}

/**
 * fuzit_profiles — returns list of available built-in profiles.
 */
export async function fuzitProfiles(
  context: McpCallContext,
): Promise<ReturnType<typeof runTool>> {
  void context;
  return runTool(async () => {
    return {
      schemaVersion: 1,
      profiles: BUILT_IN_PROFILES.map((p) => ({
        id: p.id,
        version: p.version,
        weights: p.weights,
        expansion: p.expansion,
      })),
    };
  });
}
