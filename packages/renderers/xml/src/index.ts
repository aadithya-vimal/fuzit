import { noRendererOptions, type Renderer } from "@fuzit/renderer-core";
import { contextBundleSchema, type ContextBundle } from "@fuzit/schemas";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function element(name: string, value: unknown): string {
  if (value === null) return `<${name}/>`;
  if (Array.isArray(value))
    return `<${name}>${value.map((item) => element("item", item)).join("")}</${name}>`;
  if (typeof value === "object")
    return `<${name}>${Object.entries(value)
      .map(([key, child]) => element(key, child))
      .join("")}</${name}>`;
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

export function renderXml(bundle: ContextBundle): string {
  const validated = contextBundleSchema.parse(bundle);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<contextBundle version="1">${Object.entries(
    validated,
  )
    .filter(([key]) => key !== "schemaVersion")
    .map(([key, value]) => element(key, value))
    .join("")}</contextBundle>\n`;
}

export const xmlRenderer: Renderer = {
  metadata: {
    schemaVersion: 1,
    format: "xml",
    mediaType: "application/xml",
    extension: ".xml",
    capabilities: { binary: false, diagnostics: true, provenance: true },
    deterministic: true,
  },
  options: noRendererOptions,
  render: (bundle) => renderXml(bundle),
};
