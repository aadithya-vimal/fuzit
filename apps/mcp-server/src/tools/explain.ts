import { createTaskContext } from "@fuzit/core";
import { getProfile } from "@fuzit/profiles";

import {
  type McpCallContext,
  runTool,
  validateRoot,
  validateTask,
} from "../tool-runner.js";
import type { RepositoryAcquisition } from "../workspace.js";

/**
 * fuzit_explain_selection — explains why each file was selected or excluded.
 * Returns structured safe evidence. No raw secret content is exposed.
 */
export async function fuzitExplainSelection(
  args: {
    root: unknown;
    task: unknown;
    profile?: unknown;
    budgetTokens?: unknown;
  },
  context: McpCallContext,
  acquisition: RepositoryAcquisition,
): Promise<ReturnType<typeof runTool>> {
  return runTool(async () => {
    const validRoot = await validateRoot(args.root, context);
    const task = validateTask(args.task);

    const profileId =
      typeof args.profile === "string" && args.profile.trim().length > 0
        ? args.profile.trim()
        : "feature-development";

    const budget =
      typeof args.budgetTokens === "number" && args.budgetTokens > 0
        ? Math.floor(args.budgetTokens)
        : 8000;

    const profile = getProfile(profileId);
    const items = acquisition.getItems(validRoot);

    // Sanitize task: reject strings that look like secret-shaped input
    const sanitizedTask = task
      .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, "<redacted>")
      .slice(0, 2048);

    const result = createTaskContext({
      items,
      task: sanitizedTask,
      profile,
      budgetTokens: budget,
      explain: true,
    });

    // Strip content from evidence, expose only path, score, decision, and non-redacted flag
    const safeEvidence = (result.evidence ?? []).map((e) => ({
      path: e.path,
      score: e.score,
      decision: e.decision,
      reason: e.reason,
      redacted: e.redacted,
      components: e.components,
    }));

    return {
      schemaVersion: 1,
      root: validRoot,
      task: sanitizedTask,
      profile: result.profile,
      budget: result.budget,
      selected: result.selected.map((s) => ({
        path: s.path,
        reason: s.reason,
      })),
      excluded: result.excluded,
      evidence: safeEvidence,
      index: result.index,
    };
  });
}
