import { describe, expect, it } from "vitest";
import { getProfile } from "@fuzit/profiles";

import {
  createFileContextItem,
  createTaskContext,
  normalizeRepositoryRelativePath,
  securityFilter,
} from "../src/index.js";

async function item(path: string, content: string, generated = false) {
  const relativePath = normalizeRepositoryRelativePath(path);
  const result = await securityFilter({
    path,
    readContent: async () => content,
    createItem: (safeContent) =>
      createFileContextItem(
        {
          schemaVersion: 1,
          path: relativePath,
          kind: "text",
          extension: ".js",
          language: { name: "JavaScript", confidence: 0.8 },
          sizeBytes: Buffer.byteLength(content),
          symlink: false,
          generated,
          vendored: false,
          readable: true,
        },
        {
          status: "complete",
          content: safeContent,
          sha256: "0".repeat(64),
        },
      ),
  });
  if (result.status !== "success") throw new Error(result.reason);
  return result.item;
}

describe("task-aware context ranking", () => {
  it("prioritizes explicitly mentioned implementation and test paths", async () => {
    const result = createTaskContext({
      items: [
        await item("docs/STATUS.md", "authentication ".repeat(2_000)),
        await item("src/auth.js", "export function authenticate() {}"),
        await item("tests/auth.test.js", "test authentication"),
      ],
      task: "inspect src/auth.js and tests/auth.test.js",
      profile: getProfile("bug-fix"),
      budgetTokens: 200,
    });

    expect(result.selected.map(({ path }) => path)).toEqual(
      expect.arrayContaining(["src/auth.js", "tests/auth.test.js"]),
    );
    expect(result.selected.map(({ path }) => path)).not.toContain(
      "docs/STATUS.md",
    );
  });

  it("keeps generated Fuzit output from becoming a retrieval magnet", async () => {
    const result = createTaskContext({
      items: [
        await item(
          "fuzit-context.md",
          "# Fuzit context\n\nauthentication ".repeat(100),
        ),
        await item("src/auth.js", "export function authentication() {}"),
      ],
      task: "authentication",
      profile: getProfile("bug-fix"),
      budgetTokens: 1_000,
    });

    expect(result.selected.map(({ path }) => path)).toEqual(["src/auth.js"]);
  });
});
