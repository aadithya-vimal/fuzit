import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

import { runGit } from "../src/index.js";

describe("safe Git process", () => {
  it("reports a missing executable", async () => {
    expect(
      (await runGit([], { executable: "fuzit-git-does-not-exist" })).ok,
    ).toBe(false);
  });

  it("times out and handles non-repositories", async () => {
    expect(
      (
        await runGit(["-e", "setTimeout(()=>{},1000)"], {
          executable: process.execPath,
          timeoutMs: 10,
        })
      ).timedOut,
    ).toBe(true);
    const root = await mkdtemp(join(tmpdir(), "fuzit-git-"));
    expect((await runGit(["rev-parse", "HEAD"], { cwd: root })).ok).toBe(false);
  });

  it("bounds and sanitizes hostile stderr", async () => {
    const result = await runGit(
      ["-e", "process.stderr.write('evil\\n'.repeat(1000)+'\\u0000')"],
      { executable: process.execPath, maximumBytes: 64 },
    );
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(64);
    expect(result.stderr).not.toContain("\n");
    expect(result.stderr).not.toContain("\u0000");
  });

  it("never invokes a shell", async () => {
    let shell: unknown;
    await runGit(["--version"], {
      spawnProcess(command, arguments_, options) {
        shell = options.shell;
        return spawn(command, arguments_, options);
      },
    });
    expect(shell).toBe(false);
  });
});
