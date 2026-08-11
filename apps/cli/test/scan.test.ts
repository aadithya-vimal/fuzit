import { mkdtemp, writeFile } from "node:fs/promises";
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
