import { describe, expect, it } from "vitest";

import {
  createContextBundle,
  securityFilter,
  type SecurityFilteredItem,
} from "@fuzit/core";
import type { FileContextItem } from "@fuzit/schemas";

import { renderMarkdown } from "../src/index.js";

const digest = "a".repeat(64);

async function filtered(
  path: string,
  content: string,
  status: FileContextItem["contentStatus"] = "complete",
): Promise<SecurityFilteredItem> {
  const result = await securityFilter({
    path,
    readContent: async () => content,
    createItem: (safeContent) => ({
      schemaVersion: 1,
      id: `file:${digest}`,
      kind: "file",
      path,
      content: safeContent,
      contentStatus: status,
      provenance: { source: "scanner", confidenceBasis: "test fixture" },
      lifecycle: "source",
      sensitivity: "unclassified",
      sha256: digest,
      transformations: [],
    }),
  });
  if (result.status !== "success") throw new Error(result.reason);
  return result.item;
}

function bundle(paths: readonly string[]) {
  return createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: null,
    items: paths.map((path) => ({
      id: `file:${path}`,
      path,
      sha256: digest,
      contentStatus: "complete",
      redacted: false,
    })),
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings: [],
    failedSources: [],
    budget: { bytes: 0, tokens: 0, truncated: false },
  });
}

describe("Markdown renderer", () => {
  it("escapes embedded fences", async () => {
    expect(
      renderMarkdown(bundle(["a.md"]), [await filtered("a.md", "```")]),
    ).toContain("````\n```\n````");
  });

  it("marks binary omission", async () => {
    const item = await filtered("a.bin", "", "omitted");
    expect(renderMarkdown(bundle(["a.bin"]), [item])).toContain(
      "[CONTENT OMITTED]",
    );
  });

  it("marks redaction", async () => {
    const value = ["SYNTHETIC", "TOKEN", "VALUE", "123456"].join("_");
    const output = renderMarkdown(bundle(["a.ts"]), [
      await filtered("a.ts", `token=${value}`),
    ]);
    expect(output).toContain("[CONTENT REDACTED]");
    expect(output).not.toContain(value);
  });

  it("marks truncation and renders empty files", async () => {
    expect(
      renderMarkdown(bundle(["a.ts"]), [
        await filtered("a.ts", "", "truncated"),
      ]),
    ).toContain("[CONTENT TRUNCATED]");
    expect(
      renderMarkdown(bundle(["a.ts"]), [await filtered("a.ts", "")]),
    ).toContain("```\n\n```");
  });

  it("orders paths and repeats byte-identically", async () => {
    const items = [await filtered("b.ts", "b"), await filtered("a.ts", "a")];
    const manifest = bundle(["b.ts", "a.ts"]);
    const first = renderMarkdown(manifest, items);
    expect(first.indexOf("## a.ts")).toBeLessThan(first.indexOf("## b.ts"));
    expect(renderMarkdown(manifest, items)).toBe(first);
  });
});
