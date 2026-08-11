import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "@fuzit/core";
import { resolveSymlinkSafely } from "../src/index.js";

const roots: string[] = [];
async function root() {
  const value = await mkdtemp(join(tmpdir(), "fuzit-links-"));
  roots.push(value);
  return value;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((x) => rm(x, { recursive: true, force: true })),
  );
});

async function safeSymlink(
  target: string,
  path: string,
  type?: "file" | "dir" | "junction",
): Promise<boolean> {
  try {
    const defaultType =
      type ?? (process.platform === "win32" ? "junction" : undefined);
    await symlink(target, path, defaultType);
    return true;
  } catch (error: unknown) {
    if (
      process.platform === "win32" &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EPERM"
    ) {
      try {
        await symlink(target, path, "junction");
        return true;
      } catch {
        return false;
      }
    }
    throw error;
  }
}

describe("symlink safety", () => {
  it("reports a file symlink without following by default", async () => {
    const r = await root();
    await writeFile(join(r, "target"), "x");
    const ok = await safeSymlink(join(r, "target"), join(r, "link"), "file");
    if (!ok) return; // Skip if Windows environment blocks unprivileged symlink creation

    await expect(
      resolveSymlinkSafely(
        r,
        join(r, "link"),
        normalizeRepositoryRelativePath("link"),
      ),
    ).resolves.toMatchObject({ status: "not-followed", followed: false });
  });

  it("safely follows an in-root directory symlink when explicit", async () => {
    const r = await root();
    await mkdir(join(r, "dir"));
    const ok = await safeSymlink(join(r, "dir"), join(r, "link"), "junction");
    if (!ok) return;

    await expect(
      resolveSymlinkSafely(
        r,
        join(r, "link"),
        normalizeRepositoryRelativePath("link"),
        { follow: true },
      ),
    ).resolves.toMatchObject({ status: "followed", targetPath: "dir" });
  });

  it("reports a loop", async () => {
    const r = await root();
    const ok1 = await safeSymlink(join(r, "b"), join(r, "a"));
    const ok2 = await safeSymlink(join(r, "a"), join(r, "b"));
    if (!ok1 || !ok2) return;

    await expect(
      resolveSymlinkSafely(
        r,
        join(r, "a"),
        normalizeRepositoryRelativePath("a"),
        { follow: true },
      ),
    ).resolves.toMatchObject({ status: "loop" });
  });

  it("reports a broken link", async () => {
    const r = await root();
    const ok = await safeSymlink(join(r, "missing"), join(r, "link"));
    if (!ok) return;

    await expect(
      resolveSymlinkSafely(
        r,
        join(r, "link"),
        normalizeRepositoryRelativePath("link"),
        { follow: true },
      ),
    ).resolves.toMatchObject({ status: "broken" });
  });

  it("blocks an outside-root target", async () => {
    const r = await root();
    const outside = await root();
    await writeFile(join(outside, "private"), "x");
    const ok = await safeSymlink(join(outside, "private"), join(r, "link"));
    if (!ok) return;

    await expect(
      resolveSymlinkSafely(
        r,
        join(r, "link"),
        normalizeRepositoryRelativePath("link"),
        { follow: true },
      ),
    ).resolves.toMatchObject({ status: "outside-root", followed: false });
  });

  it("applies the same boundary rule to a Windows junction", async () => {
    const r = await root();
    const outside = await root();
    await mkdir(join(outside, "dir"));
    const ok = await safeSymlink(join(outside, "dir"), join(r, "junction"), "junction");
    if (!ok) return;

    await expect(
      resolveSymlinkSafely(
        r,
        join(r, "junction"),
        normalizeRepositoryRelativePath("junction"),
        { follow: true },
      ),
    ).resolves.toMatchObject({ status: "outside-root" });
  });
});
