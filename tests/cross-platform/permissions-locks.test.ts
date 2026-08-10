import { spawn } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IndexWriterLock } from "@fuzit/watcher";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "fuzit-permissions-"));
  roots.push(root);
  return root;
}

describe("permission, lock, and cleanup fixtures", () => {
  it("rejects an active writer lock without replacing it", async () => {
    const root = await fixtureRoot();
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    try {
      expect(child.pid).toBeTypeOf("number");
      const metadata = {
        lockVersion: 1,
        pid: child.pid,
        createdAt: new Date().toISOString(),
        repositoryId: "repo-active",
        hostname: "fixture-host",
        sessionId: "fixture-session",
      };
      await writeFile(join(root, "writer.lock"), JSON.stringify(metadata));
      const lock = new IndexWriterLock({
        indexPath: root,
        repositoryId: "repo-active",
      });
      await expect(lock.acquire()).rejects.toThrow("Writer lock active");
      expect(
        JSON.parse(await readFile(join(root, "writer.lock"), "utf8")),
      ).toEqual(metadata);
    } finally {
      child.kill();
    }
  });

  it("replaces a stale lock and removes only its own lock on release", async () => {
    const parent = await fixtureRoot();
    const root = join(parent, "index");
    const sentinel = join(parent, "owner-sentinel.txt");
    await mkdir(root);
    await writeFile(sentinel, "keep");
    await writeFile(
      join(root, "writer.lock"),
      JSON.stringify({
        lockVersion: 1,
        pid: 2_147_483_647,
        createdAt: "2000-01-01T00:00:00.000Z",
        repositoryId: "repo-stale",
        hostname: "fixture-host",
        sessionId: "stale-session",
      }),
    );
    const lock = new IndexWriterLock({
      indexPath: root,
      repositoryId: "repo-stale",
      staleThresholdMs: 1,
    });
    await lock.acquire();
    expect(lock.metadata?.pid).toBe(process.pid);
    await lock.release();
    await expect(access(join(root, "writer.lock"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(sentinel, "utf8")).toBe("keep");
  });

  it("maps read-only behavior according to host filesystem semantics", async () => {
    const root = await fixtureRoot();
    const file = join(root, "read-only.txt");
    await writeFile(file, "original");
    await chmod(file, 0o444);
    try {
      if (process.platform === "win32") {
        expect(await readFile(file, "utf8")).toBe("original");
      } else {
        await expect(writeFile(file, "changed")).rejects.toMatchObject({
          code: expect.stringMatching(/EACCES|EPERM|EROFS/u),
        });
      }
    } finally {
      await chmod(file, 0o666);
    }
  });
});
