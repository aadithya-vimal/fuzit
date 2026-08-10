import {
  assertSecurityFilteredItem,
  type SecurityFilteredItem,
} from "@fuzit/core";
import type { ContextBundle } from "@fuzit/schemas";
import { noRendererOptions, type Renderer } from "@fuzit/renderer-core";

function fenceFor(content: string): string {
  const longest =
    [...content.matchAll(/`+/g)].reduce(
      (maximum, match) => Math.max(maximum, match[0].length),
      0,
    ) + 1;
  return "`".repeat(Math.max(3, longest));
}

export function renderMarkdown(
  bundle: ContextBundle,
  items: readonly SecurityFilteredItem[],
): string {
  for (const item of items) assertSecurityFilteredItem(item);
  const ordered = [...items].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  const lines = [
    "# Fuzit Context Bundle",
    "",
    `- Bundle: \`${bundle.id}\``,
    `- Root: \`${bundle.source.root}\``,
    `- Files: ${ordered.length}`,
    `- Estimated tokens: ${bundle.budget.tokens}`,
    "",
    "## Manifest",
    "",
    "```json",
    JSON.stringify(bundle),
    "```",
  ];

  for (const item of ordered) {
    lines.push(
      "",
      "---",
      "",
      `## ${item.path}`,
      "",
      `Provenance: ${item.provenance.source} (${item.provenance.confidenceBasis})`,
    );
    if (item.contentStatus === "omitted" || item.content === null) {
      lines.push("", "[CONTENT OMITTED]");
      continue;
    }
    if (item.findings.length > 0) lines.push("", "[CONTENT REDACTED]");
    if (item.contentStatus === "truncated")
      lines.push("", "[CONTENT TRUNCATED]");
    const fence = fenceFor(item.content);
    lines.push("", fence, item.content, fence);
  }

  if (bundle.warnings.length > 0 || bundle.failedSources.length > 0) {
    lines.push("", "## Diagnostics", "");
    for (const warning of bundle.warnings) lines.push(`- Warning: ${warning}`);
    for (const source of bundle.failedSources)
      lines.push(`- Failed source: ${source}`);
  }

  return `${lines.join("\n")}\n`;
}

export const markdownRenderer: Renderer = {
  metadata: {
    schemaVersion: 1,
    format: "markdown",
    mediaType: "text/markdown",
    extension: ".md",
    capabilities: { binary: false, diagnostics: true, provenance: true },
    deterministic: true,
  },
  options: noRendererOptions,
  render: (bundle, items) => renderMarkdown(bundle, items),
};
