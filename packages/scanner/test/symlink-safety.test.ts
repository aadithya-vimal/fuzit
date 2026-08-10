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

describe("symlink safety", () => {
  it("reports a file symlink without following by default", async () => {
    const r = await root();
    await writeFile(join(r, "target"), "x");
    await symlink(join(r, "target"), join(r, "link"));
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
    await symlink(join(r, "dir"), join(r, "link"), "junction");
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
    await symlink(join(r, "b"), join(r, "a"));
    await symlink(join(r, "a"), join(r, "b"));
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
    await symlink(join(r, "missing"), join(r, "link"));
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
    await symlink(join(outside, "private"), join(r, "link"));
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
    await symlink(join(outside, "dir"), join(r, "junction"), "junction");
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
