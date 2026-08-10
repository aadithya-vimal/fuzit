import { describe, expect, it } from "vitest";

import {
  createContextBundle,
  serializeContextBundle,
  type ContextBundleInput,
} from "../src/index.js";

const digest = "a".repeat(64);

function input(
  overrides: Partial<ContextBundleInput> = {},
): ContextBundleInput {
  return {
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: null,
    items: [],
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings: [],
    failedSources: [],
    budget: { bytes: 0, tokens: 0, truncated: false },
    ...overrides,
  };
}

describe("ContextBundle", () => {
  it("creates an empty schema-versioned bundle", () => {
    expect(createContextBundle(input())).toMatchObject({
      schemaVersion: 1,
      items: [],
    });
  });

  it("records partial bundles and failed sources", () => {
    expect(
      createContextBundle(
        input({ warnings: ["partial"], failedSources: ["unreadable"] }),
      ),
    ).toMatchObject({ warnings: ["partial"], failedSources: ["unreadable"] });
  });

  it.each([
    ["redacted", true, "complete"],
    ["truncated", false, "truncated"],
  ] as const)("records a %s item", (_name, redacted, contentStatus) => {
    const bundle = createContextBundle(
      input({
        items: [
          {
            id: "file:test",
            path: "a.ts",
            sha256: digest,
            contentStatus,
            redacted,
          },
        ],
      }),
    );
    expect(bundle.items[0]).toMatchObject({ redacted, contentStatus });
  });

  it("serializes with stable ordering", () => {
    const items = ["b.ts", "a.ts"].map((path) => ({
      id: `file:${path}`,
      path,
      sha256: digest,
      contentStatus: "complete" as const,
      redacted: false,
    }));
    const first = createContextBundle(input({ items }));
    const second = createContextBundle(input({ items: [...items].reverse() }));
    expect(serializeContextBundle(first)).toBe(serializeContextBundle(second));
    expect(first.id).toBe(second.id);
  });
});
