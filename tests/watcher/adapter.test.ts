import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { NativeFilesystemAdapter } from "@fuzit/watcher";
import type { WatcherEvent } from "@fuzit/schemas";

const REPO_ROOT = resolve("tests/watcher/tmp-repo");

describe("filesystem event adapter", () => {
  it("normalizes relative and absolute paths within root", async () => {
    const events: WatcherEvent[] = [];
    const adapter = new NativeFilesystemAdapter({
      repositoryRoot: REPO_ROOT,
      onEvent: (e) => events.push(e),
    });
    await adapter.start();

    const ev1 = adapter.emitSyntheticEvent("add", "src/a.ts");
    expect(ev1.path).toBe("src/a.ts");

    const absolutePath = join(REPO_ROOT, "src", "b.ts");
    const ev2 = adapter.emitSyntheticEvent("modify", absolutePath);
    expect(ev2.path).toBe("src/b.ts");

    expect(events.length).toBe(2);
    await adapter.stop();
  });

  it("rejects path escape outside repository root", async () => {
    const adapter = new NativeFilesystemAdapter({
      repositoryRoot: REPO_ROOT,
    });
    await adapter.start();

    expect(() => adapter.emitSyntheticEvent("modify", "../outside.ts")).toThrow(
      "path traversal",
    );
    const absoluteOutsidePath = resolve(REPO_ROOT, "..", "outside.ts");
    expect(() =>
      adapter.emitSyntheticEvent("modify", absoluteOutsidePath),
    ).toThrow("Path escape detected");
    await adapter.stop();
  });

  it("filters ignored paths", async () => {
    const adapter = new NativeFilesystemAdapter({
      repositoryRoot: REPO_ROOT,
      ignorePatterns: ["node_modules", ".git"],
    });
    await adapter.start();

    expect(() =>
      adapter.emitSyntheticEvent("modify", "node_modules/pkg/index.js"),
    ).toThrow("Ignored path change rejected");
    await adapter.stop();
  });
});
