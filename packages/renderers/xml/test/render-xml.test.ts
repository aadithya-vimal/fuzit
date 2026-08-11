import { describe, expect, it } from "vitest";

import {
  createContextBundle,
  securityFilter,
  type SecurityFilteredItem,
} from "@fuzit/core";

import { renderXml } from "../src/index.js";

const digest = "a".repeat(64);
async function createTestItem(
  path: string,
  content: string,
  status: "complete" | "truncated" | "omitted" = "complete",
): Promise<SecurityFilteredItem> {
  const result = await securityFilter({
    path,
    readContent: async () => content,
    createItem: (safe) => ({
      schemaVersion: 1,
      id: `file:${digest}`,
      kind: "file",
      path,
      content: status === "omitted" ? null : safe,
      contentStatus: status,
      provenance: { source: "scanner", confidenceBasis: "test" },
      lifecycle: "source",
      sensitivity: "unclassified",
      sha256: digest,
      transformations: [],
    }),
  });
  if (result.status !== "success") throw new Error(result.reason);
  return result.item;
}

function bundle(warnings: string[] = []) {
  return createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: null,
    items: [],
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings,
    failedSources: [],
    budget: { bytes: 100, tokens: 25, truncated: false },
  });
}

describe("XML renderer", () => {
  it("escapes markup and CDATA-like content", () => {
    const output = renderXml(bundle(["<&]]>"]));
    expect(output).toContain("&lt;&amp;]]&gt;");
    expect(output).not.toContain("<![CDATA[");
  });

  it("preserves Unicode and empty fields", () => {
    const output = renderXml(bundle(["世界"]));
    expect(output).toContain("世界");
    expect(output).toContain("<failedSources></failedSources>");
    expect(output).toContain("<revision/>");
  });

  it("never emits DTD or external entities", () => {
    const output = renderXml(bundle());
    expect(output).not.toMatch(/<!DOCTYPE|<!ENTITY/i);
    expect(output.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
  });

  it("renders explicit LLM-optimized file tags with code contents", async () => {
    const item = await createTestItem("src/index.ts", "console.log('hello world');");
    const output = renderXml(bundle(), [item]);
    expect(output).toContain('<file path="src/index.ts" content_status="complete" redacted="false">');
    expect(output).toContain("console.log(&apos;hello world&apos;);");
    expect(output).toContain("</file>");
    expect(output).toContain('<file_entry path="src/index.ts" status="complete" />');
  });
});
