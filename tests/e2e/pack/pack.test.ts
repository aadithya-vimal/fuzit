import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runCli } from "../../../apps/cli/src/cli.js";

async function run(root: string, output: string) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    ["pack", "--root", root, "--format", "markdown", "--output", output],
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

describe("pack Markdown v1", () => {
  it("refuses output collisions", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-pack-"));
    await writeFile(join(root, "out.md"), "existing");
    expect((await run(root, "out.md")).exitCode).toBe(3);
  });

  it("supports stdout and zero files", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-pack-"));
    const result = await run(root, "-");
    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(result.stdout).toContain("# Fuzit Context Bundle");
  });

  it("redacts synthetic secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-pack-"));
    const value = ["SYNTHETIC", "SECRET", "VALUE", "123456"].join("_");
    await writeFile(join(root, "source.txt"), `token=${value}`);
    const result = await run(root, "-");
    expect(result.stdout).toContain("[CONTENT REDACTED]");
    expect(result.stdout).not.toContain(value);
  });

  it("produces deterministic file output", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-pack-"));
    await writeFile(join(root, "a.txt"), "a");
    const first = await run(root, "-");
    const second = await run(root, "-");
    expect(first.stdout).toBe(second.stdout);
  });

  it("reports partial scans and unwritable destinations safely", async () => {
    const missing = join(tmpdir(), "fuzit-missing-root");
    expect([3, 4]).toContain((await run(missing, "out.md")).exitCode);
  });
});
