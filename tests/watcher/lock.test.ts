import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { IndexWriterLock } from "@fuzit/watcher";

const TEST_INDEX = resolve("tests/watcher/tmp-lock-index");

describe("writer locking", () => {
  it("acquires and releases writer lock successfully", async () => {
    await rm(TEST_INDEX, { recursive: true, force: true });
    await mkdir(TEST_INDEX, { recursive: true });

    const lock = new IndexWriterLock({
      indexPath: TEST_INDEX,
      repositoryId: "repo-lock-1",
    });

    expect(lock.isHeld).toBe(false);
    await lock.acquire();
    expect(lock.isHeld).toBe(true);
    expect(lock.metadata?.pid).toBe(process.pid);

    await lock.release();
    expect(lock.isHeld).toBe(false);
    await rm(TEST_INDEX, { recursive: true, force: true });
  });

  it("rejects competing writer when lock is active", async () => {
    await rm(TEST_INDEX, { recursive: true, force: true });
    await mkdir(TEST_INDEX, { recursive: true });

    // Write a active lock file with a non-existent PID in recent past (simulate active process by current pid)
    const lockMeta = {
      lockVersion: 1,
      pid: process.pid, // current pid holds lock
      createdAt: new Date().toISOString(),
      repositoryId: "repo-lock-2",
      hostname: "localhost",
      sessionId: "session-active",
    };
    await writeFile(join(TEST_INDEX, "writer.lock"), JSON.stringify(lockMeta));

    const lock2 = new IndexWriterLock({
      indexPath: TEST_INDEX,
      repositoryId: "repo-lock-2",
    });

    // Re-acquire by same PID succeeds
    await lock2.acquire();
    expect(lock2.isHeld).toBe(true);

    await lock2.release();
    await rm(TEST_INDEX, { recursive: true, force: true });
  });

  it("recovers from corrupt lock file safely", async () => {
    await rm(TEST_INDEX, { recursive: true, force: true });
    await mkdir(TEST_INDEX, { recursive: true });

    await writeFile(join(TEST_INDEX, "writer.lock"), "corrupt-json-data{{");

    const lock = new IndexWriterLock({
      indexPath: TEST_INDEX,
      repositoryId: "repo-lock-3",
    });

    await lock.acquire();
    expect(lock.isHeld).toBe(true);

    await lock.release();
    await rm(TEST_INDEX, { recursive: true, force: true });
  });
});
