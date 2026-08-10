import { describe, expect, it } from "vitest";

import { createContextBundle } from "@fuzit/core";

import { renderXml } from "../src/index.js";

function bundle(warnings: string[] = []) {
  return createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: null,
    items: [],
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings,
    failedSources: [],
    budget: { bytes: 0, tokens: 0, truncated: false },
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
});
