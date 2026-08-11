import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

const spawnSync = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawnSync,
  };
});

async function capture(
  args: readonly string[],
  environment: Record<string, string | undefined> = {},
) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    args,
    {
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
    },
    { environment, repositoryRoot: process.cwd() },
  );
  return { exitCode, stdout, stderr };
}

beforeEach(() => {
  spawnSync.mockReset();
});

describe("auth command", () => {
  it("shows anonymous status with next steps", async () => {
    spawnSync.mockImplementation((command: string) => {
      if (command !== "gh") return { status: 1, stdout: "", stderr: "" };
      if (spawnSync.mock.calls.some((call) => call[1]?.[0] === "--version")) {
        return { status: 1, stdout: "", stderr: "" };
      }
      return { status: 1, stdout: "", stderr: "" };
    });
    const result = await capture(["auth", "status"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("GitHub Authentication");
    expect(result.stdout).toContain("Not authenticated");
    expect(result.stdout).toContain("fuzit auth github");
  });

  it("reports environment token authentication", async () => {
    spawnSync.mockImplementation(() => ({ status: 1, stdout: "", stderr: "" }));
    const result = await capture(["auth", "status"], {
      GH_TOKEN: "gh-token-for-tests",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Authenticated");
    expect(result.stdout).toContain("GH_TOKEN");
    expect(result.stdout).not.toContain("gh-token-for-tests");
  });

  it("reports authenticated GitHub CLI status when gh is logged in", async () => {
    spawnSync.mockImplementation((command: string, args?: readonly string[]) => {
      if (command !== "gh") return { status: 1, stdout: "", stderr: "" };
      if (args?.[0] === "--version") {
        return { status: 0, stdout: "gh version 2.0.0", stderr: "" };
      }
      if (args?.[0] === "auth" && args?.[1] === "token") {
        return { status: 0, stdout: "mock-gh-token\n", stderr: "" };
      }
      return { status: 1, stdout: "", stderr: "" };
    });

    const result = await capture(["auth", "status"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Status: Authenticated");
    expect(result.stdout).toContain("Source: github-cli");
    expect(result.stdout).not.toContain("mock-gh-token");
  });
});
