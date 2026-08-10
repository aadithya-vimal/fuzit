import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { validateRoot } from "../../apps/mcp-server/src/tool-runner.js";
import {
  validateAllowedRoots,
  validatePath,
} from "../../apps/mcp-server/src/workspace.js";

const temporaryRoots: string[] = [];

async function temporaryDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), `fuzit-${name}-`));
  temporaryRoots.push(directory);
  return directory;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("MCP workspace allow-list", () => {
  it("canonicalizes and deterministically orders a multi-root session", async () => {
    const first = await temporaryDirectory("allow-a");
    const second = await temporaryDirectory("allow-b");
    const allowed = await validateAllowedRoots([second, first, second]);
    const expected = [await realpath(first), await realpath(second)].sort(
      (a, b) => Buffer.from(a).compare(Buffer.from(b)),
    );
    expect(allowed).toEqual(expected);
  });

  it("rejects traversal and an unknown nested root without leaking metadata", async () => {
    const root = await temporaryDirectory("allow-root");
    const child = resolve(root, "nested");
    await mkdir(child);
    const allowedRoots = await validateAllowedRoots([root]);

    await expect(validateRoot(child, { allowedRoots })).rejects.toThrow(
      /Unknown workspace root/,
    );
    await expect(
      validatePath(resolve(root, ".."), allowedRoots),
    ).rejects.toThrow(/not within any allowed workspace root/);
  });

  it("detects a workspace symlink swapped after startup", async () => {
    const container = await temporaryDirectory("allow-swap");
    const first = resolve(container, "first");
    const second = resolve(container, "second");
    const link = resolve(container, "workspace-link");
    await mkdir(first);
    await mkdir(second);
    await symlink(
      first,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );

    const allowedRoots = await validateAllowedRoots([link]);
    await rm(link, { force: true });
    await symlink(
      second,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(validateRoot(link, { allowedRoots })).rejects.toThrow(
      /not within any allowed workspace root/,
    );
  });

  it("uses native case semantics for root identity", async () => {
    const root = await temporaryDirectory("allow-case");
    const allowedRoots = await validateAllowedRoots([root]);
    const variant = root.toUpperCase();
    if (process.platform === "win32") {
      await expect(validateRoot(variant, { allowedRoots })).resolves.toBe(
        allowedRoots[0],
      );
    } else {
      await expect(validateRoot(variant, { allowedRoots })).rejects.toThrow();
    }
  });
});
