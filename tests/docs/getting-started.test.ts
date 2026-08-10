import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("installation and quick start", () => {
  it("documents prerequisites, private paths, first workflow, and cleanup", async () => {
    const source = await readFile(
      resolve(root, "docs/getting-started/installation.md"),
      "utf8",
    );
    for (const required of [
      "Node.js 24.x",
      "pnpm 11.9.0",
      "no authorized public release",
      "fuzit doctor --json",
      "fuzit scan --root . --list-roots",
      "fuzit pack --root .",
      "fuzit context --root .",
      "Remove-Item -LiteralPath",
      "rm --",
    ]) {
      expect(source).toContain(required);
    }
  });

  it("ties documented commands to packed-artifact smoke coverage", async () => {
    const smoke = await readFile(
      resolve(root, "scripts/package-smoke.mjs"),
      "utf8",
    );
    for (const command of ["doctor", "scan", "pack", "context"]) {
      expect(smoke).toContain(`"${command}"`);
    }
    expect(smoke).toContain('run("pnpm", ["install", "--offline"]');
  });

  it("warns against public resolution and unsafe recursive cleanup", async () => {
    const source = await readFile(
      resolve(root, "docs/getting-started/installation.md"),
      "utf8",
    );
    expect(source).toMatch(/Do not resolve missing\s+private dependencies/);
    expect(source).toContain("Do not recursively delete repository state");
    expect(source).not.toContain("npm install -g");
  });
});
