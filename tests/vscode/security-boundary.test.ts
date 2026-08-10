import { describe, expect, it, vi } from "vitest";

import { executeEngineCommand } from "../../apps/vscode-extension/src/adapter.js";
import {
  activate,
  deactivate,
  registerDeactivationCleanup,
} from "../../apps/vscode-extension/src/extension.js";
import {
  renderPreview,
  writeToOutputChannel,
} from "../../apps/vscode-extension/src/preview.js";
import { assertTrusted } from "../../apps/vscode-extension/src/trust.js";

describe("VS Code security boundary (V1-117)", () => {
  it("refuses untrusted and missing workspace roots before work starts", () => {
    expect(
      assertTrusted(
        { isTrusted: false, workspaceRoot: "C:\\malicious\\root" },
        "scan",
      ),
    ).toMatchObject({ ok: false });
    expect(
      assertTrusted({ isTrusted: true, workspaceRoot: "" }, "scan"),
    ).toMatchObject({ ok: false });
  });

  it("passes malicious process strings as literal arguments without a shell", async () => {
    const task = "$(whoami); echo injected && calc.exe";
    const result = await executeEngineCommand(
      ["-e", "console.log(process.argv[1])", task],
      { cliPath: process.execPath },
    );
    expect(result).toMatchObject({ exitCode: 0 });
    expect(result.stdout.trim()).toBe(task);
  });

  it("redacts sensitive CLI paths, previews, and output-channel content", async () => {
    const secret = "password=hunter2";
    await expect(
      executeEngineCommand([], { cliPath: `missing-${secret}` }),
    ).rejects.not.toThrow(secret);

    const preview = renderPreview(`Failure: ${secret}`, {
      workspaceRoot: process.cwd(),
    });
    expect(preview).not.toContain("hunter2");

    const lines: string[] = [];
    writeToOutputChannel(
      { clear() {}, appendLine: (line) => lines.push(line), show() {} },
      `token=${"a".repeat(48)}`,
      { workspaceRoot: process.cwd() },
    );
    expect(lines.join("\n")).not.toContain("a".repeat(48));
  });

  it("runs registered cleanup exactly once during deactivation", () => {
    const cleanup = vi.fn();
    const context = { subscriptions: [] as { dispose(): void }[] };
    activate(context);
    registerDeactivationCleanup(cleanup);
    deactivate();
    deactivate();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
