import {
  assertSecurityFilteredItem,
  type SecurityFilteredItem,
} from "@fuzit/core";
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

export function renderXml(
  bundle: ContextBundle,
  items: readonly SecurityFilteredItem[] = [],
): string {
  const validated = contextBundleSchema.parse(bundle);
  for (const item of items) assertSecurityFilteredItem(item);

  const ordered = [...items].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push(`<contextBundle version="1">`);

  if (validated.instruction) {
    lines.push(`  <instruction>${escapeXml(validated.instruction)}</instruction>`);
  }

  lines.push(`  <summary>`);
  lines.push(`    <id>${escapeXml(validated.id)}</id>`);
  lines.push(`    <root>${escapeXml(validated.source.root)}</root>`);
  if (validated.revision) {
    lines.push(`    <revision>${escapeXml(validated.revision)}</revision>`);
  } else {
    lines.push(`    <revision/>`);
  }
  lines.push(`    <files_count>${ordered.length || validated.items.length}</files_count>`);
  lines.push(`    <total_bytes>${validated.budget.bytes}</total_bytes>`);
  lines.push(`    <total_tokens>${validated.budget.tokens}</total_tokens>`);

  if (validated.warnings.length > 0) {
    lines.push(
      `    <warnings>${validated.warnings.map((w) => `<warning>${escapeXml(w)}</warning>`).join("")}</warnings>`,
    );
  } else {
    lines.push(`    <warnings></warnings>`);
  }

  if (validated.failedSources.length > 0) {
    lines.push(
      `    <failedSources>${validated.failedSources.map((f) => `<failedSource>${escapeXml(f)}</failedSource>`).join("")}</failedSources>`,
    );
  } else {
    lines.push(`    <failedSources></failedSources>`);
  }
  lines.push(`  </summary>`);

  lines.push(`  <manifest>`);
  const manifestItems = ordered.length > 0 ? ordered : validated.items;
  for (const item of manifestItems) {
    const status = "contentStatus" in item ? item.contentStatus : "complete";
    lines.push(
      `    <file_entry path="${escapeXml(item.path)}" status="${escapeXml(status)}" />`,
    );
  }
  lines.push(`  </manifest>`);

  lines.push(`  <files>`);
  if (ordered.length > 0) {
    for (const item of ordered) {
      const status = item.contentStatus;
      const redacted = item.findings.length > 0;
      lines.push(
        `    <file path="${escapeXml(item.path)}" content_status="${status}" redacted="${redacted}">`,
      );
      if (item.contentStatus === "omitted" || item.content === null) {
        lines.push(`[CONTENT OMITTED]`);
      } else {
        lines.push(escapeXml(item.content));
      }
      lines.push(`    </file>`);
    }
  } else {
    for (const item of validated.items) {
      lines.push(
        `    <file path="${escapeXml(item.path)}" content_status="${item.contentStatus}" redacted="${item.redacted}" />`,
      );
    }
  }
  lines.push(`  </files>`);

  lines.push(`</contextBundle>\n`);
  return lines.join("\n");
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
  render: (bundle, items) => renderXml(bundle, items),
};
