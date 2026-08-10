import { describe, expect, it } from "vitest";

import { createContextBundle, serializeContextBundle } from "../src/index.js";

const base = {
  schemaVersion: 1 as const,
  source: { kind: "repository" as const, root: "." },
  revision: null,
  items: [],
  redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
  warnings: [],
  failedSources: [],
  budget: { bytes: 0, tokens: 0, truncated: false },
};

describe("Git bundle context", () => {
  it("preserves non-Git behavior and optional Git evidence", () => {
    expect(createContextBundle(base).git).toBeUndefined();
    const bundle = createContextBundle({
      ...base,
      git: {
        identity: { available: false },
        changes: [{ path: "a.ts", kind: "unstaged" }],
        history: [{ hash: "a".repeat(40) }],
        diff: { patch: "[REDACTED:api-key]" },
      },
    });
    expect(JSON.parse(serializeContextBundle(bundle))).toHaveProperty("git");
  });

  it("serializes detached and partial Git context deterministically", () => {
    const input = {
      ...base,
      revision: "a".repeat(40),
      warnings: ["partial history"],
      git: {
        identity: { detached: true },
        changes: [],
        history: [],
        diff: null,
      },
    };
    expect(serializeContextBundle(createContextBundle(input))).toBe(
      serializeContextBundle(createContextBundle(input)),
    );
  });
});
