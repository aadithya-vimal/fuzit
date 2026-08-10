import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const candidates = [
  "apps/cli",
  "apps/mcp-server",
  "apps/vscode-extension",
  "packages/plugin-sdk",
] as const;

type PackEntry = { path: string };
type PackResult = { files: PackEntry[] };

function assertSafeListing(paths: string[]): void {
  const forbidden = [
    /(^|\/)\.fuzit-development(\/|$)/,
    /(^|\/)\.v1-development(\/|$)/,
    /(^|\/)\.cache(\/|$)/,
    /(^|\/)\.turbo(\/|$)/,
    /(^|\/)node_modules(\/|$)/,
    /(^|\/)implementation-plan(\/|$)/,
    /(^|\/)specs(\/|$)/,
    /(^|\/)src(\/|$)/,
    /(^|\/)test(s)?(\/|$)/,
    /\.map$/,
    /(^|\/)(\.env|credentials|secrets?)(\.|\/|$)/i,
    /^[A-Za-z]:[\\/]/,
    /^\//,
  ];
  for (const path of paths) {
    if (forbidden.some((pattern) => pattern.test(path))) {
      throw new Error(`forbidden package entry: ${path}`);
    }
  }
}

function dryRunListing(directory: string): string[] {
  const pnpmArguments = ["--dir", directory, "pack", "--dry-run", "--json"];
  const executable =
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
  const arguments_ =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm.cmd", ...pnpmArguments]
      : pnpmArguments;
  const result = spawnSync(executable, arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(
      `pack listing failed for ${directory}: ${result.error?.message ?? result.stderr}`,
    );
  }
  const parsed = JSON.parse(result.stdout) as PackResult | PackResult[];
  const pack = Array.isArray(parsed) ? parsed[0] : parsed;
  return (pack?.files ?? []).map(({ path }) => path).sort();
}

describe("release package contents", () => {
  it("uses complete publishable metadata and strict allow-lists", async () => {
    for (const directory of candidates) {
      const manifest = JSON.parse(
        await readFile(resolve(root, directory, "package.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(manifest.private).toBe(false);
      expect(manifest.license).toBe("MIT");
      expect(manifest.files).toEqual(
        expect.arrayContaining([expect.stringMatching(/^dist\/.*\.js$/)]),
      );
      expect(manifest.repository).toMatchObject({
        type: "git",
        directory,
      });
    }
  });

  it("produces deterministic safe dry-run listings", () => {
    for (const directory of candidates) {
      const first = dryRunListing(directory);
      const second = dryRunListing(directory);
      expect(second).toEqual(first);
      expect(first).toContain("package.json");
      assertSafeListing(first);
    }
  }, 30_000);

  it("fails closed on a private source or map entry", () => {
    expect(() =>
      assertSafeListing(["dist/index.js", "src/private.ts"]),
    ).toThrow("forbidden package entry: src/private.ts");
    expect(() => assertSafeListing(["dist/index.js.map"])).toThrow(
      "forbidden package entry: dist/index.js.map",
    );
  });
});
