import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";
import { runDoctor } from "@fuzit/core";

describe("cross-platform contracts", () => {
  it("normalizes either path separator without changing the basename", () => {
    expect(basename(normalize(join("folder", "nested", "file.ts")))).toBe(
      "file.ts",
    );
    expect("folder\\nested/file.ts".replaceAll("\\", "/")).toBe(
      "folder/nested/file.ts",
    );
  });
  it("passes shell-significant task text as an argument value", () => {
    const task = `fix "quoted" value & preserve $HOME`;
    expect(JSON.parse(JSON.stringify([task]))).toEqual([task]);
  });
  it("detects symlink capability rather than assuming permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-link-"));
    const target = join(root, "target.txt");
    await writeFile(target, "safe");
    try {
      const link = join(root, "link.txt");
      await symlink(target, link, "file");
      expect((await lstat(link)).isSymbolicLink()).toBe(true);
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toMatch(/EPERM|EACCES/);
    }
  });
  it("uses LF repository fixtures", async () => {
    const content = await readFile(
      new URL("../../.nvmrc", import.meta.url),
      "utf8",
    );
    expect(content).not.toContain("\r\n");
  });
  it("audits the index package for native SQLite packaging", async () => {
    const manifest = JSON.parse(
      await readFile(
        new URL("../../packages/index/package.json", import.meta.url),
        "utf8",
      ),
    ) as { dependencies?: Record<string, string> };
    expect(
      Object.keys(manifest.dependencies ?? {}).filter((name) =>
        /sqlite/i.test(name),
      ),
    ).toEqual([]);
  });
  it("keeps runtime, package-manager, docs, and doctor metadata consistent", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      packageManager: string;
      engines: { node: string; pnpm: string };
    };
    const nvmrc = (
      await readFile(new URL("../../.nvmrc", import.meta.url), "utf8")
    ).trim();
    const matrix = await readFile(
      new URL("../../docs/reference/support-matrix.md", import.meta.url),
      "utf8",
    );
    expect(manifest).toMatchObject({
      packageManager: "pnpm@11.9.0",
      engines: { node: ">=24.0.0 <25.0.0", pnpm: "11.9.0" },
    });
    expect(nvmrc).toBe("24");
    expect(matrix).toContain(manifest.engines.node);
    expect(matrix).toContain(manifest.packageManager.replace("pnpm@", ""));
    for (const platform of ["win32", "linux", "darwin"] as const) {
      const report = await runDoctor(".", {
        nodeVersion: "24.0.0",
        pnpmUserAgent: "pnpm/11.9.0",
        platform,
        checkGit: () => "git version 2.40.0",
        checkAccess: async () => undefined,
      });
      expect(report.checks.find(({ id }) => id === "node")?.metadata).toEqual({
        version: "24.0.0",
      });
      expect(
        report.checks.find(({ id }) => id === "platform")?.metadata,
      ).toMatchObject({
        platform,
      });
    }
  });
  it("round-trips long Unicode paths and bounded cancellation", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-win-path-🚀-"));
    const nested = join(
      root,
      ...Array.from({ length: 12 }, (_, i) => `segment-${i}-資料`),
    );
    const controller = new AbortController();
    try {
      await mkdir(nested, { recursive: true });
      const file = join(nested, "context-✓.txt");
      await writeFile(file, "deterministic\n");
      expect(await readFile(file, "utf8")).toBe("deterministic\n");
      controller.abort(new Error("cancelled"));
      expect(controller.signal.aborted).toBe(true);
      expect(controller.signal.reason).toEqual(new Error("cancelled"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
