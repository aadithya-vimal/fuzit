import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { assertWithinAllowedRoots } from "../config.js";
import {
  type McpCallContext,
  runTool,
  validateRoot,
  validateTask,
} from "../tool-runner.js";
import type { RepositoryAcquisition } from "../workspace.js";
import { getProfile } from "@fuzit/profiles";
import { createTaskContext, renderTaskContext } from "@fuzit/core";

const ALLOWED_FORMATS = ["markdown", "json", "text", "xml"] as const;
type BundleFormat = (typeof ALLOWED_FORMATS)[number];

/**
 * fuzit_create_bundle — creates a context bundle file within the workspace root.
 * Output is written to a bounded, approved directory under the workspace root.
 */
export async function fuzitCreateBundle(
  args: {
    root: unknown;
    task: unknown;
    profile?: unknown;
    budgetTokens?: unknown;
    format?: unknown;
    outputSubpath?: unknown;
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

    const format: BundleFormat =
      typeof args.format === "string" &&
      ALLOWED_FORMATS.includes(args.format as BundleFormat)
        ? (args.format as BundleFormat)
        : "markdown";

    // Output must stay within workspace root under .fuzit-bundles/
    const outputSubpath =
      typeof args.outputSubpath === "string" &&
      args.outputSubpath.trim().length > 0
        ? args.outputSubpath.trim()
        : `bundle-${Date.now()}.${format === "markdown" ? "md" : format}`;

    // Validate the output path stays within the workspace root
    const outputDir = join(validRoot, ".fuzit-bundles");
    const outputPath = join(outputDir, outputSubpath);
    assertWithinAllowedRoots(outputPath, context.allowedRoots);

    // Build context
    const profile = getProfile(profileId);
    const items = acquisition.getItems(validRoot);
    const result = createTaskContext({
      items,
      task,
      profile,
      budgetTokens: budget,
    });
    const rendered = renderTaskContext(result, format);

    // Write to disk
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, rendered, "utf8");

    return {
      schemaVersion: 1,
      root: validRoot,
      outputPath: outputPath.replace(validRoot, "<root>"),
      format,
      task: result.task,
      profile: result.profile,
      selected: result.selected.length,
      budget: result.budget,
    };
  });
}
