import {
  assertSecurityFilteredItem,
  type SecurityFilteredItem,
} from "@fuzit/core";
import { noRendererOptions, type Renderer } from "@fuzit/renderer-core";
import type { ContextBundle } from "@fuzit/schemas";

function boundary(content: string): string {
  let value = "==== FUZIT FILE BOUNDARY ====";
  while (content.includes(value)) value += "=";
  return value;
}

export function renderText(
  bundle: ContextBundle,
  items: readonly SecurityFilteredItem[],
): string {
  for (const item of items) assertSecurityFilteredItem(item);
  const lines = [
    ...(bundle.instruction ? ["USER INSTRUCTION:", bundle.instruction, "========================================", ""] : []),
    "FUZIT CONTEXT BUNDLE",
    `Bundle: ${bundle.id}`,
    `Root: ${bundle.source.root}`,
    `Files: ${items.length}`,
    ...(bundle.git === undefined
      ? []
      : [
          `Git changes: ${bundle.git.changes.length}`,
          `Git history entries: ${bundle.git.history.length}`,
          `Git diff: ${bundle.git.diff === null ? "not included" : "included"}`,
        ]),
  ];
  for (const item of [...items].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  )) {
    const marker = boundary(item.content ?? "");
    lines.push(
      "",
      marker,
      `Path: ${item.path}`,
      `Status: ${item.contentStatus}`,
    );
    if (item.findings.length > 0) lines.push("[CONTENT REDACTED]");
    if (item.contentStatus === "truncated") lines.push("[CONTENT TRUNCATED]");
    if (item.content === null || item.contentStatus === "omitted")
      lines.push("[CONTENT OMITTED]");
    else lines.push(item.content);
    lines.push(marker);
  }
  return `${lines.join("\n")}\n`;
}

export const textRenderer: Renderer = {
  metadata: {
    schemaVersion: 1,
    format: "text",
    mediaType: "text/plain",
    extension: ".txt",
    capabilities: { binary: false, diagnostics: true, provenance: true },
    deterministic: true,
  },
  options: noRendererOptions,
  render: (bundle, items) => renderText(bundle, items),
};
