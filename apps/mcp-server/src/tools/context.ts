import { createTaskContext } from "@fuzit/core";
import { getProfile } from "@fuzit/profiles";

import { MAX_SEARCH_RESULTS } from "../config.js";
import {
  type McpCallContext,
  runTool,
  validateRoot,
  validateTask,
} from "../tool-runner.js";
import type { RepositoryAcquisition } from "../workspace.js";

/**
 * fuzit_search — keyword search over repository items.
 * Returns bounded list of paths ranked by relevance score.
 */
export async function fuzitSearch(
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

    const result = createTaskContext({
      items,
      task,
      profile,
      budgetTokens: budget,
    });

    return {
      schemaVersion: 1,
      root: validRoot,
      task: result.task,
      profile: result.profile,
      selected: result.selected.slice(0, MAX_SEARCH_RESULTS).map((s) => ({
        path: s.path,
        reason: s.reason,
      })),
      excluded: result.excluded.length,
      budget: result.budget,
      index: result.index,
    };
  });
}

/**
 * fuzit_get_context — get full context bundle for a task.
 * Returns selected file paths and content within budget limits.
 */
export async function fuzitGetContext(
  args: {
    root: unknown;
    task: unknown;
    profile?: unknown;
    budgetTokens?: unknown;
    explain?: unknown;
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

    const explain = args.explain === true;
    const profile = getProfile(profileId);
    const items = acquisition.getItems(validRoot);

    const result = createTaskContext({
      items,
      task,
      profile,
      budgetTokens: budget,
      explain,
    });

    return result;
  });
}
