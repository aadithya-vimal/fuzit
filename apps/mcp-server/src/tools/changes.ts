import { collectGitHistory } from "@fuzit/git";

import { type McpCallContext, runTool, validateRoot } from "../tool-runner.js";

/** Maximum commits returned by fuzit_recent_changes */
const MAX_COMMITS = 50;

/**
 * fuzit_recent_changes — returns bounded recent Git commits.
 * Author emails are omitted for privacy. Absolute paths are redacted.
 */
export async function fuzitRecentChanges(
  args: {
    root: unknown;
    limit?: unknown;
  },
  context: McpCallContext,
): Promise<ReturnType<typeof runTool>> {
  return runTool(async () => {
    const validRoot = await validateRoot(args.root, context);
    const limit =
      typeof args.limit === "number" && args.limit > 0
        ? Math.min(Math.floor(args.limit), MAX_COMMITS)
        : 20;

    const entries = await collectGitHistory(validRoot, {
      limit,
      emailPolicy: "omit",
    });

    return {
      schemaVersion: 1,
      root: validRoot,
      commits: entries.map((e) => ({
        hash: e.hash,
        authorName: e.authorName,
        timestamp: e.timestamp,
        subject: e.subject,
        changedPaths: e.changedPaths.slice(0, 100),
      })),
    };
  });
}
