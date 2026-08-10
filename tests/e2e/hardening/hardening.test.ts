import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../../../apps/cli/src/cli.js";
import { runGit } from "../../../packages/git/src/index.js";

async function command(
  arguments_: readonly string[],
  root: string,
  environment: Readonly<Record<string, string | undefined>>,
) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    arguments_,
    {
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
    },
    { repositoryRoot: root, environment },
  );
  return { exitCode, stdout, stderr };
}

describe("post-runbook CLI integration", () => {
  it("populates exact repository intelligence deterministically", async () => {
    const base = await mkdtemp(join(tmpdir(), "fuzit-intelligence-"));
    const root = join(base, "repository");
    await mkdir(root);
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        scripts: { start: "node src/index.ts" },
        dependencies: { express: "1" },
        devDependencies: { vitest: "1" },
      }),
    );
    await writeFile(
      join(root, "fuzit.config.json"),
      '{"exclude":["config-excluded.txt"]}\n',
    );
    await writeFile(join(root, ".gitignore"), ".env\n");
    await writeFile(join(root, ".env"), "TOKEN=SYNTHETIC_SECRET_123456789\n");
    await writeFile(join(root, "config-excluded.txt"), "excluded\n");
    await writeFile(
      join(root, "pnpm-workspace.yaml"),
      "packages:\n  - apps/*\n",
    );
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src", "index.ts"),
      "import express from 'express';\n",
    );
    await writeFile(join(root, "worker.py"), "print('safe')\n");
    const first = join(base, "first.json");
    const second = join(base, "second.json");
    for (const output of [first, second]) {
      const result = await command(
        ["pack", "--root", root, "--format", "json", "--output", output],
        root,
        {},
      );
      expect(result.exitCode, result.stderr).toBe(0);
    }
    expect(await readFile(first, "utf8")).toBe(await readFile(second, "utf8"));
    const bundle = JSON.parse(await readFile(first, "utf8")) as {
      intelligence: {
        languages: string[];
        packages: string[];
        frameworks: string[];
        tests: string[];
        dependencies: string[];
        entryPoints: string[];
      };
      items: { path: string }[];
    };
    expect(bundle.items.some(({ path }) => path === ".env")).toBe(false);
    expect(
      bundle.items.some(({ path }) => path === "config-excluded.txt"),
    ).toBe(false);
    expect(bundle.intelligence.languages).toEqual(["Python", "TypeScript"]);
    expect(bundle.intelligence.frameworks).toContain("express");
    expect(bundle.intelligence.tests).toContain("vitest");
    expect(bundle.intelligence.dependencies).toContain("express");
    expect(bundle.intelligence.packages).toContain("workspace:apps/*");
    expect(bundle.intelligence.entryPoints).toContain("src");
  }, 15_000);

  it("captures stable real snapshots, deltas, and pack-since scope", async () => {
    const base = await mkdtemp(join(tmpdir(), "fuzit-snapshot-"));
    const root = join(base, "repository");
    const cache = join(base, "cache");
    await mkdir(root);
    await writeFile(join(root, "value.ts"), "export const value = 1;\n");
    await writeFile(join(root, "deleted.ts"), "export const old = true;\n");
    await writeFile(
      join(root, "unrelated.ts"),
      "export const stable = true;\n",
    );
    expect((await runGit(["init"], { cwd: root })).ok).toBe(true);
    expect((await runGit(["add", "."], { cwd: root })).ok).toBe(true);
    expect(
      (
        await runGit(
          [
            "-c",
            "user.name=Fuzit Test",
            "-c",
            "user.email=fuzit@example.invalid",
            "commit",
            "-m",
            "fixture",
          ],
          { cwd: root },
        )
      ).ok,
    ).toBe(true);
    const environment = { FUZIT_CACHE_HOME: cache };
    const create = async () => {
      const result = await command(
        ["snapshot", "create", "--root", root],
        root,
        environment,
      );
      expect(result.exitCode, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as {
        id: string;
        repositoryRevision: string | null;
        dirty: boolean;
        fileFingerprints: { path: string; sha256: string }[];
      };
    };
    const before = await create();
    expect(before.repositoryRevision).toMatch(/^[a-f0-9]{40,64}$/);
    expect(before.dirty).toBe(false);
    expect(before.fileFingerprints.map(({ path }) => path)).toEqual([
      "deleted.ts",
      "unrelated.ts",
      "value.ts",
    ]);
    await writeFile(join(root, "value.ts"), "export const value = 2;\n");
    await writeFile(join(root, "added.ts"), "export const added = true;\n");
    await rm(join(root, "deleted.ts"));
    const after = await create();
    const repeated = await create();
    expect(after.id).not.toBe(before.id);
    expect(after.dirty).toBe(true);
    expect(repeated.id).toBe(after.id);
    const difference = await command(
      ["diff", before.id, after.id],
      root,
      environment,
    );
    const delta = JSON.parse(difference.stdout) as {
      files: { path: string; kind: string }[];
    };
    expect(delta.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "added.ts", kind: "added" }),
        expect.objectContaining({ path: "value.ts", kind: "modified" }),
        expect.objectContaining({ path: "deleted.ts", kind: "deleted" }),
      ]),
    );
    const output = join(base, "delta.json");
    const packed = await command(
      [
        "pack",
        "--root",
        root,
        "--format",
        "json",
        "--output",
        output,
        "--since",
        before.id,
      ],
      root,
      environment,
    );
    expect(packed.exitCode, packed.stderr).toBe(0);
    const bundle = JSON.parse(await readFile(output, "utf8")) as {
      items: { path: string }[];
      warnings: string[];
    };
    expect(bundle.items.map(({ path }) => path)).toEqual([
      "added.ts",
      "value.ts",
    ]);
    expect(bundle.warnings).toContain("Deleted since baseline: deleted.ts");
  }, 15_000);

  it("persists cache state and reports semantic rebuild decisions", async () => {
    const base = await mkdtemp(join(tmpdir(), "fuzit-cache-"));
    const root = join(base, "repository");
    const cache = join(base, "cache");
    const environment = { FUZIT_CACHE_HOME: cache };
    await mkdir(root);
    await writeFile(join(root, "value.ts"), "export const value = 1;\n");
    const invoke = async (arguments_: readonly string[]) => {
      const result = await command(arguments_, root, environment);
      expect(result.exitCode, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    };
    expect((await invoke(["cache", "status", "--root", root])).state).toBe(
      "absent",
    );
    const initialized = await invoke(["cache", "init", "--root", root]);
    expect(initialized.state).toBe("ready");
    const indexPath = initialized.path as string;
    const semanticBefore = await readFile(
      join(indexPath, "semantic.json"),
      "utf8",
    );
    for (const [name, extra, expected] of [
      ["indexed", [] as string[], "used"],
      ["direct", ["--no-index"], "bypassed"],
    ] as const) {
      const output = join(base, `${name}.json`);
      await command(
        [
          "context",
          "--root",
          root,
          "--task",
          "value",
          "--profile",
          "bug-fix",
          "--budget-tokens",
          "100",
          "--format",
          "json",
          "--output",
          output,
          ...extra,
        ],
        root,
        environment,
      );
      expect(
        (JSON.parse(await readFile(output, "utf8")) as { index: string }).index,
      ).toBe(expected);
    }
    expect(await readFile(join(indexPath, "semantic.json"), "utf8")).toBe(
      semanticBefore,
    );
    expect((await invoke(["cache", "status", "--root", root])).state).toBe(
      "ready",
    );
    expect(
      (
        (await invoke(["cache", "rebuild", "--root", root, "--dry-run"]))
          .decision as { action: string }
      ).action,
    ).toBe("reuse");
    await writeFile(join(root, "value.ts"), "export const value = 2;\n");
    expect(
      (
        (await invoke(["cache", "rebuild", "--root", root, "--dry-run"]))
          .decision as { action: string }
      ).action,
    ).toBe("rebuild");
    await invoke(["cache", "rebuild", "--root", root]);
    expect((await invoke(["cache", "status", "--root", root])).state).toBe(
      "ready",
    );
    await invoke(["cache", "purge", "--root", root, "--dry-run"]);
    expect((await invoke(["cache", "status", "--root", root])).state).toBe(
      "ready",
    );
    await invoke(["cache", "purge", "--root", root]);
    expect((await invoke(["cache", "status", "--root", root])).state).toBe(
      "absent",
    );
  }, 15_000);
});
