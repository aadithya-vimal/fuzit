import { createHash } from "node:crypto";

import { contextBundleSchema, type ContextBundle } from "@fuzit/schemas";

export type ContextBundleInput = Omit<ContextBundle, "id">;

export function createContextBundle(input: ContextBundleInput): ContextBundle {
  const normalized = {
    ...input,
    items: [...input.items].sort((left, right) =>
      left.path.localeCompare(right.path, "en"),
    ),
    warnings: [...input.warnings].sort(),
    failedSources: [...input.failedSources].sort(),
  };
  const identity = createHash("sha256")
    .update(JSON.stringify(normalized), "utf8")
    .digest("hex");
  return contextBundleSchema.parse({
    ...normalized,
    id: `bundle:${identity}`,
  });
}

export function serializeContextBundle(bundle: ContextBundle): string {
  return `${JSON.stringify(contextBundleSchema.parse(bundle))}\n`;
}
