import { describe, expect, it } from "vitest";

import type { FileRecord } from "@fuzit/schemas";

import { createFileContextItem } from "../src/index.js";

const digest = "a".repeat(64);

function record(path: string, overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    schemaVersion: 1,
    path,
    kind: "text",
    extension: ".ts",
    language: { name: "TypeScript", confidence: 1 },
    sizeBytes: 4,
    symlink: false,
    generated: false,
    vendored: false,
    readable: true,
    ...overrides,
  };
}

describe("createFileContextItem", () => {
  it("produces a stable ID across repeated scans", () => {
    const first = createFileContextItem(record("src/a.ts"), {
      status: "complete",
      content: "test",
      sha256: digest,
    });
    const second = createFileContextItem(record("src/a.ts"), {
      status: "complete",
      content: "test",
      sha256: digest,
    });

    expect(second.id).toBe(first.id);
  });

  it("produces a new file ID after a rename", () => {
    const before = createFileContextItem(record("src/a.ts"), {
      status: "complete",
      content: "test",
      sha256: digest,
    });
    const after = createFileContextItem(record("src/b.ts"), {
      status: "complete",
      content: "test",
      sha256: digest,
    });

    expect(after.id).not.toBe(before.id);
  });

  it("records omitted content", () => {
    const item = createFileContextItem(record("src/a.ts"), {
      status: "omitted",
      content: null,
      sha256: digest,
    });

    expect(item).toMatchObject({
      content: null,
      contentStatus: "omitted",
      transformations: ["canonical-path", "content-omitted"],
    });
  });

  it("records truncated content", () => {
    const item = createFileContextItem(record("src/a.ts"), {
      status: "truncated",
      content: "test",
      sha256: digest,
    });

    expect(item.transformations).toContain("bounded-truncation");
  });

  it.each([
    [{ generated: true }, "generated"],
    [{ vendored: true }, "vendored"],
  ] as const)("records %s lifecycle", (overrides, lifecycle) => {
    const item = createFileContextItem(record("src/a.ts", overrides), {
      status: "complete",
      content: "test",
      sha256: digest,
    });

    expect(item.lifecycle).toBe(lifecycle);
  });
});
