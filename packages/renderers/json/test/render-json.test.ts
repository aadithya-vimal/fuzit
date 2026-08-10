import { describe, expect, it } from "vitest";

import { createContextBundle } from "@fuzit/core";
import { contextBundleSchema } from "@fuzit/schemas";

import { renderJson } from "../src/index.js";

function bundle(overrides: Record<string, unknown> = {}) {
  return createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: null,
    items: [],
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings: [],
    failedSources: [],
    budget: { bytes: 0, tokens: 0, truncated: false },
    ...overrides,
  });
}

describe("canonical JSON renderer", () => {
  it("supports pretty and compact modes", () => {
    expect(renderJson(bundle(), { pretty: true })).toContain("\n  ");
    expect(renderJson(bundle(), { pretty: false }).split("\n")).toHaveLength(2);
  });

  it("preserves Unicode and validates against the schema", () => {
    const output = renderJson(bundle({ warnings: ["世界"] }));
    expect(output).toContain("世界");
    expect(contextBundleSchema.parse(JSON.parse(output))).toBeDefined();
  });

  it("avoids unsafe large integers", () => {
    const value = bundle();
    Object.assign(value.budget, { bytes: Number.MAX_SAFE_INTEGER + 1 });
    expect(() => renderJson(value)).toThrow();
  });

  it("renders redaction and partial bundle metadata", () => {
    const output = JSON.parse(
      renderJson(
        bundle({
          redactionSummary: {
            findings: 1,
            redactedItems: 1,
            omittedItems: 0,
          },
          warnings: ["partial"],
          failedSources: ["a.ts"],
        }),
      ),
    ) as Record<string, unknown>;
    expect(output).toMatchObject({
      redactionSummary: { findings: 1, redactedItems: 1 },
      warnings: ["partial"],
      failedSources: ["a.ts"],
    });
  });
});
