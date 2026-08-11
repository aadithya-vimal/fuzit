import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";

async function scan(root: string, mode = "--items") {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    ["scan", "--root", root, mode, "--json"],
    {
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
    },
    { repositoryRoot: root, environment: {} },
  );
  return { exitCode, stdout, stderr };
}

async function capture(root: string, args: readonly string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    args,
    {
      writeOut: (value) => (stdout += value),
      writeErr: (value) => (stderr += value),
    },
    { repositoryRoot: root, environment: {} },
  );
  return { exitCode, stdout, stderr };
}

describe("scan baseline", () => {
  it("shows restrained progress in human mode and suppresses it for JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-progress-scan-"));
    await writeFile(join(root, "app.ts"), "export {};");
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["scan", "--root", root],
      {
        writeOut: (value) => (stdout += value),
        writeErr: (value) => (stderr += value),
      },
      { repositoryRoot: root, environment: {} },
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"status":"complete"');
    expect(stderr).toContain("Fuzit v0.0.1 · Scanning repository...");
    expect(stderr).toContain("scan complete");

    const machine = await scan(root, "--summary");
    expect(machine.stderr).toBe("");
    expect(() => JSON.parse(machine.stdout)).not.toThrow();
  });

  it("uses a useful summary for a bare scan", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-default-scan-"));
    await writeFile(join(root, "app.jsx"), "export const App = () => null;");
    const result = await scan(root, "");

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "complete",
      counts: { files: 1 },
    });
  });

  it("keeps the default summary useful in quiet mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-quiet-scan-"));
    await writeFile(join(root, "app.ts"), "export {};");
    const result = await capture(root, ["--quiet", "scan", "--root", root]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "complete",
      counts: { files: 1, directories: 0, symlinks: 0 },
    });
  });

  it("preserves explicit root listing", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-roots-scan-"));
    await mkdir(join(root, ".git"));
    const result = await capture(root, [
      "--json",
      "scan",
      "--root",
      root,
      "--list-roots",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: 1,
      selectedRoot: ".",
      nestedRoots: [],
      inputWasSymlink: false,
    });
  });

  it("rejects conflicting explicit scan modes", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-mode-scan-"));
    const result = await capture(root, [
      "scan",
      "--root",
      root,
      "--summary",
      "--list-roots",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("SCAN.MODE_CONFLICT");
    expect(result.stderr).toContain("--summary, --list-roots");
  });

  it("rejects a missing repository root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "fuzit-missing-scan-"));
    const result = await capture(parent, [
      "scan",
      "--root",
      join(parent, "missing"),
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("SCAN.INVALID_ROOT");
  });

  it("handles an empty repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-empty-"));
    expect(await scan(root, "--summary")).toMatchObject({
      exitCode: 0,
      stderr: "",
    });
  });

  it("handles a large synthetic repository deterministically", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-large-"));
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        writeFile(join(root, `${index.toString().padStart(3, "0")}.txt`), "x"),
      ),
    );

    expect((await scan(root)).stdout).toBe((await scan(root)).stdout);
  }, 30_000);

  it("keeps JSON output free of TTY progress", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-json-"));
    await writeFile(join(root, "a.txt"), "x");
    const result = await scan(root);

    expect(result.stderr).toBe("");
    expect(() => JSON.parse(result.stdout.trim())).not.toThrow();
  });
});
