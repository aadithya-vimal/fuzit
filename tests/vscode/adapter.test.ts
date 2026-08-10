import { describe, it, expect } from "vitest";
import { executeEngineCommand } from "../../apps/vscode-extension/src/adapter.js";

describe("Engine Adapter (V1-091)", () => {
  it("rejects non-string argument types", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(executeEngineCommand(["--task", 123 as any])).rejects.toThrow(
      TypeError,
    );
  });

  it("handles missing CLI binary cleanly without crashing process", async () => {
    await expect(
      executeEngineCommand(["--help"], {
        cliPath: "nonexistent-fuzit-bin-1234",
      }),
    ).rejects.toThrow(/Fuzit CLI binary not found/);
  });

  it("safely passes malicious shell characters as literal arguments (no shell: true)", async () => {
    const maliciousArgs = [
      "--task",
      "fix bug; echo injected && calc.exe | $(whoami)",
    ];
    const result = await executeEngineCommand(
      [
        "-e",
        "console.log(process.argv.slice(1).join(' '))",
        "--",
        ...maliciousArgs,
      ],
      { cliPath: process.execPath },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("injected");
  });

  it("supports paths with spaces and Unicode characters", async () => {
    const spacePath = "folder with spaces/Unicode_🚀_test";
    const result = await executeEngineCommand(
      ["-e", "console.log(process.argv[1])", spacePath],
      { cliPath: process.execPath },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("folder with spaces/Unicode_🚀_test");
  });
});
