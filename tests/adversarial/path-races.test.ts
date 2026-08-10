import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "@fuzit/core";
import { assertWithinAllowedRoots } from "@fuzit/mcp-server";
import { resolveSymlinkSafely } from "@fuzit/scanner";
import { securityFilter } from "../../packages/core/src/pipeline/security-filter.js";

describe("malicious paths, symlinks, and races (V1-114)", () => {
  const temporaryPaths: string[] = [];
  afterEach(async () => {
    for (const path of temporaryPaths.splice(0)) {
      await rm(path, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100,
      });
    }
  });

  it("rejects traversal while preserving Unicode lookalikes and case-distinct identities", () => {
    expect(() => normalizeRepositoryRelativePath("../../outside")).toThrow();
    expect(() => normalizeRepositoryRelativePath("C:\\outside")).toThrow();
    expect(normalizeRepositoryRelativePath("src/．．/safe.ts")).toBe(
      "src/．．/safe.ts",
    );
    expect(
      [
        normalizeRepositoryRelativePath("src/File.ts"),
        normalizeRepositoryRelativePath("src/file.ts"),
      ].sort(),
    ).toEqual(["src/File.ts", "src/file.ts"]);
  });

  it("handles long and deep repository-relative paths deterministically", () => {
    const deep = `${Array.from({ length: 80 }, (_, index) => `segment-${index}`).join("/")}/file.ts`;
    expect(normalizeRepositoryRelativePath(deep)).toBe(deep);
    expect(normalizeRepositoryRelativePath(deep)).toBe(deep);
  });

  it("fails closed for symlink loops and revalidates a swapped target", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-path-race-"));
    const outside = await mkdtemp(join(tmpdir(), "fuzit-path-outside-"));
    temporaryPaths.push(root, outside);
    await mkdir(join(root, "inside"));
    await writeFile(join(root, "inside", "safe.txt"), "safe");
    await writeFile(join(outside, "private.txt"), "outside");
    const link = join(root, "candidate");

    try {
      await symlink(join(root, "inside", "safe.txt"), link, "file");
      await expect(
        resolveSymlinkSafely(root, link, "candidate" as never, {
          follow: true,
        }),
      ).resolves.toMatchObject({ followed: true, status: "followed" });
      await unlink(link);
      await symlink(join(outside, "private.txt"), link, "file");
      await expect(
        resolveSymlinkSafely(root, link, "candidate" as never, {
          follow: true,
        }),
      ).resolves.toMatchObject({ followed: false, status: "outside-root" });

      const first = join(root, "loop-a");
      const second = join(root, "loop-b");
      await symlink(second, first, "file");
      await symlink(first, second, "file");
      await expect(
        resolveSymlinkSafely(root, first, "loop-a" as never, { follow: true }),
      ).resolves.toMatchObject({ followed: false, status: "loop" });
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toMatch(/EPERM|EACCES/u);
    }
  });

  it("omits locked reads and rejects unsafe cache or output paths", async () => {
    await expect(
      securityFilter({
        path: "locked.txt",
        readContent: async () => {
          throw Object.assign(new Error("locked"), { code: "EACCES" });
        },
        createItem: () => {
          throw new Error("must not create an item after a locked read");
        },
      }),
    ).resolves.toEqual({
      status: "partial",
      path: "locked.txt",
      reason: "content-read-failed",
    });

    const root = resolve("repository");
    expect(() =>
      assertWithinAllowedRoots(resolve(root, "..", "cache"), [root]),
    ).toThrow();
    expect(() =>
      assertWithinAllowedRoots(resolve(root, "..", "output.json"), [root]),
    ).toThrow();
  });
});
