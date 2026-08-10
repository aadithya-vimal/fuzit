import type { Renderer, RendererOptionSchema } from "@fuzit/renderer-core";
import { contextBundleSchema, type ContextBundle } from "@fuzit/schemas";

export interface JsonRendererOptions {
  readonly pretty: boolean;
}

export function renderJson(
  bundle: ContextBundle,
  options: JsonRendererOptions = { pretty: true },
): string {
  const validated = contextBundleSchema.parse(bundle);
  const serialized = JSON.stringify(
    validated,
    (_key, value: unknown) => {
      if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        !Number.isSafeInteger(value)
      )
        throw new RangeError("JSON renderer refuses unsafe integers.");
      return value;
    },
    options.pretty ? 2 : undefined,
  );
  return `${serialized}\n`;
}

const jsonOptions: RendererOptionSchema<JsonRendererOptions> = {
  parse(value): JsonRendererOptions {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new TypeError("JSON renderer options must be an object.");
    const entries = Object.entries(value);
    if (
      entries.some(([key]) => key !== "pretty") ||
      ("pretty" in value && typeof value.pretty !== "boolean")
    )
      throw new TypeError("JSON renderer accepts only boolean pretty.");
    return { pretty: "pretty" in value ? value.pretty === true : true };
  },
};

export const jsonRenderer: Renderer = {
  metadata: {
    schemaVersion: 1,
    format: "json",
    mediaType: "application/json",
    extension: ".json",
    capabilities: { binary: false, diagnostics: true, provenance: true },
    deterministic: true,
  },
  options: jsonOptions,
  render: (bundle, _items, options) =>
    renderJson(bundle, jsonOptions.parse(options)),
};
