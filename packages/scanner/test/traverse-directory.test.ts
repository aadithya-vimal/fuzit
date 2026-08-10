import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  TraversalError,
  traverseDirectory,
  type TraversalDirectoryEntry,
  type TraversalEntry,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function createDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-traversal-"));
  temporaryDirectories.push(directory);
  return directory;
}

function entry(
  name: string,
  kind: "file" | "directory" = "file",
): TraversalDirectoryEntry {
  return {
    name,
    isDirectory: () => kind === "directory",
    isSymbolicLink: () => false,
  };
}

async function collect(
  root: string,
  options: Parameters<typeof traverseDirectory>[1] = {},
): Promise<readonly TraversalEntry[]> {
  const entries: TraversalEntry[] = [];
  for await (const item of traverseDirectory(root, options)) {
    entries.push(item);
  }
  return entries;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("deterministic directory traversal", () => {
  it("returns identical bytewise ordering across repeated runs", async () => {
    const root = await createDirectory();
    await mkdir(join(root, "a"));
    await writeFile(join(root, "z.txt"), "");
    await writeFile(join(root, "A.txt"), "");
    await writeFile(join(root, "a", "one.txt"), "");

    const first = await collect(root);
    const second = await collect(root);

    expect(first).toEqual(second);
    expect(first.map(({ path }) => path)).toEqual([
      "A.txt",
      "a",
      "a/one.txt",
      "z.txt",
    ]);
  });

  it("yields empty directories without fabricating children", async () => {
    const root = await createDirectory();
    await mkdir(join(root, "empty"));

    await expect(collect(root)).resolves.toEqual([
      { path: "empty", kind: "directory" },
    ]);
  });

  it("returns a typed permission-denied failure", async () => {
    const readDirectory = async (path: string) => {
      if (path === "root") {
        return [entry("blocked", "directory")];
      }
      const error = new Error("denied");
      Object.assign(error, { code: "EACCES" });
      throw error;
    };

    await expect(collect("root", { readDirectory })).rejects.toMatchObject({
      code: "TRAVERSAL.PERMISSION_DENIED",
    });
  });

  it("handles a deep tree without recursive call-stack growth", async () => {
    const depth = 500;
    const readDirectory = async (path: string) => {
      const name = basename(path);
      const level = name === "root" ? 0 : Number(name.slice(1));
      return level < depth ? [entry(`d${level + 1}`, "directory")] : [];
    };

    const result = await collect("root", { readDirectory });

    expect(result).toHaveLength(depth);
    expect(result.at(-1)?.path.split("/")).toHaveLength(depth);
  });

  it("honors cancellation between streamed entries", async () => {
    const root = await createDirectory();
    await writeFile(join(root, "a.txt"), "");
    await writeFile(join(root, "b.txt"), "");
    const controller = new AbortController();
    const iterator = traverseDirectory(root, { signal: controller.signal });

    await expect(iterator.next()).resolves.toMatchObject({
      value: { path: "a.txt" },
      done: false,
    });
    controller.abort();
    await expect(iterator.next()).rejects.toBeInstanceOf(TraversalError);
  });

  it("streams a large file count with one bounded directory read", async () => {
    const fileCount = 5_000;
    let activeReads = 0;
    let maximumActiveReads = 0;
    const readDirectory = async () => {
      activeReads += 1;
      maximumActiveReads = Math.max(maximumActiveReads, activeReads);
      const entries = Array.from({ length: fileCount }, (_, index) =>
        entry(`file-${index.toString().padStart(5, "0")}.txt`),
      );
      activeReads -= 1;
      return entries;
    };

    const result = await collect("root", { readDirectory });

    expect(result).toHaveLength(fileCount);
    expect(maximumActiveReads).toBe(1);
  });
});
