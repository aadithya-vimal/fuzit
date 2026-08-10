import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { intentionalFailurePlugin } from "../../examples/plugins/intentional-failure/src/index.js";
import { referencePlugin } from "../../examples/plugins/reference/src/index.js";

const bundle = {
  schemaVersion: 1 as const,
  id: `bundle:${"a".repeat(64)}`,
  source: { kind: "repository" as const, root: "<root>" },
  revision: null,
  items: [
    {
      id: "b",
      path: "src/z.ts",
      sha256: "b".repeat(64),
      contentStatus: "complete" as const,
      redacted: false,
    },
    {
      id: "a",
      path: "src/a.ts",
      sha256: "a".repeat(64),
      contentStatus: "complete" as const,
      redacted: false,
    },
  ],
  redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
  warnings: ["z-warning", "a-warning"],
  failedSources: [],
  budget: { bytes: 0, tokens: 0, truncated: false },
};

describe("reference plugins", () => {
  it("renders byte-stable output and a deterministic profile", async () => {
    const renderer = referencePlugin.handlers.renderer;
    const profile = referencePlugin.handlers.profile;
    expect(renderer).toBeDefined();
    expect(profile).toBeDefined();
    const first = await renderer!({ bundle });
    const second = await renderer!({ bundle });
    expect(first).toEqual(second);
    expect(first.renderedText).toBe(
      '{"schemaVersion":1,"bundleId":"bundle:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","paths":["src/a.ts","src/z.ts"],"warnings":["a-warning","z-warning"]}',
    );
    expect(
      await profile!({
        taskDescription: "safe fixture",
        profileName: "review",
      }),
    ).toMatchObject({
      profileName: "review-reference",
      rules: { deterministic: true },
    });
  });

  it("attributes the sanitized intentional failure to its plugin", async () => {
    const renderer = intentionalFailurePlugin.handlers.renderer;
    expect(renderer).toBeDefined();
    await expect(
      Promise.resolve().then(() => renderer!({ bundle })),
    ).rejects.toThrow("REFERENCE_PLUGIN_FAILURE");
    expect(intentionalFailurePlugin.manifest.id).toBe(
      "dev.fuzit.intentional-failure",
    );
  });

  it("uses only the public plugin SDK in both fixtures", async () => {
    for (const source of [
      "examples/plugins/reference/src/index.ts",
      "examples/plugins/intentional-failure/src/index.ts",
    ]) {
      const contents = await readFile(source, "utf8");
      expect(contents).toContain('from "@fuzit/plugin-sdk"');
      expect(contents).not.toMatch(
        /@fuzit\/(?:plugin-host|schemas)|packages\//u,
      );
    }
  });
});
