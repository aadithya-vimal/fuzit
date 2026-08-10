import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { verifyEventAgainstFilesystem } from "@fuzit/watcher";
import type { WatcherEvent } from "@fuzit/schemas";

const TEST_REPO = resolve("tests/watcher/tmp-verifier-repo");

describe("event filesystem verification", () => {
  it("verifies modify event on real existing file as upsert with valid contentHash", async () => {
    await rm(TEST_REPO, { recursive: true, force: true });
    await mkdir(join(TEST_REPO, "src"), { recursive: true });
    await writeFile(join(TEST_REPO, "src/hello.ts"), "console.log('hello');");

    const event: WatcherEvent = {
      contractVersion: 1,
      kind: "modify",
      path: "src/hello.ts",
      timestampMs: Date.now(),
    };

    const outcome = await verifyEventAgainstFilesystem(event, {
      repositoryRoot: TEST_REPO,
    });
    expect(outcome.action).toBe("upsert");
    if (outcome.action === "upsert") {
      expect(outcome.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(outcome.sizeBytes).toBeGreaterThan(0);
    }
    await rm(TEST_REPO, { recursive: true, force: true });
  });

  it("treats modify event on deleted file as delete outcome", async () => {
    await rm(TEST_REPO, { recursive: true, force: true });
    await mkdir(TEST_REPO, { recursive: true });

    const event: WatcherEvent = {
      contractVersion: 1,
      kind: "modify",
      path: "src/deleted.ts",
      timestampMs: Date.now(),
    };

    const outcome = await verifyEventAgainstFilesystem(event, {
      repositoryRoot: TEST_REPO,
    });
    expect(outcome.action).toBe("delete");
    await rm(TEST_REPO, { recursive: true, force: true });
  });

  it("ignores event matching ignore pattern", async () => {
    const event: WatcherEvent = {
      contractVersion: 1,
      kind: "add",
      path: "node_modules/dep/index.js",
      timestampMs: Date.now(),
    };

    const outcome = await verifyEventAgainstFilesystem(event, {
      repositoryRoot: TEST_REPO,
      ignorePatterns: ["node_modules"],
    });
    expect(outcome.action).toBe("ignore");
  });
});
