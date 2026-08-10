import { describe, expect, it } from "vitest";

import {
  createContextBundle,
  securityFilter,
  type SecurityFilteredItem,
} from "@fuzit/core";

import { renderText } from "../src/index.js";

const digest = "a".repeat(64);
async function item(
  content: string,
  status: "complete" | "truncated" | "omitted" = "complete",
): Promise<SecurityFilteredItem> {
  const result = await securityFilter({
    path: "a.txt",
    readContent: async () => content,
    createItem: (safe) => ({
      schemaVersion: 1,
      id: `file:${digest}`,
      kind: "file",
      path: "a.txt",
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

function bundle() {
  return createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: null,
    items: [],
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings: [],
    failedSources: [],
    budget: { bytes: 0, tokens: 0, truncated: false },
  });
}

describe("plain-text renderer", () => {
  it("avoids boundary collisions", async () => {
    const output = renderText(bundle(), [
      await item("==== FUZIT FILE BOUNDARY ===="),
    ]);
    expect(output).toContain("==== FUZIT FILE BOUNDARY =====");
  });

  it("renders empty, redacted, and truncated markers", async () => {
    expect(renderText(bundle(), [await item("")])).toContain(
      "Status: complete",
    );
    const secret = ["SYNTHETIC", "TOKEN", "VALUE", "123456"].join("_");
    expect(renderText(bundle(), [await item(`token=${secret}`)])).toContain(
      "[CONTENT REDACTED]",
    );
    expect(renderText(bundle(), [await item("x", "truncated")])).toContain(
      "[CONTENT TRUNCATED]",
    );
  });

  it("is deterministic", async () => {
    const items = [await item("a")];
    expect(renderText(bundle(), items)).toBe(renderText(bundle(), items));
  });
});
