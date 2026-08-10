import { describe, expect, it } from "vitest";
import { runGit } from "@fuzit/git";
import { EXIT_CODES } from "@fuzit/schemas";
import { withTimeout } from "../../apps/mcp-server/src/tool-runner.js";
import { WatchRegistry } from "../../apps/vscode-extension/src/watch.js";

describe("cross-platform process cancellation", () => {
  it("cancels a spawned Git-owned process with common result semantics", async () => {
    const controller = new AbortController();
    const resultPromise = runGit(["-e", "setInterval(() => {}, 1000)"], {
      executable: process.execPath,
      signal: controller.signal,
      timeoutMs: 10_000,
    });
    controller.abort(new Error("cancelled by fixture"));
    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      cancelled: true,
      timedOut: false,
    });
  });

  it("propagates MCP cancellation and disposes its timeout listener", async () => {
    const controller = new AbortController();
    const operation = withTimeout(
      (signal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
      controller.signal,
      10_000,
    );
    controller.abort(new Error("client cancelled"));
    await expect(operation).rejects.toThrow("client cancelled");
  });

  it("cancels every extension-owned watcher and returns to idle", () => {
    const registry = new WatchRegistry();
    const first = registry.start("repository-a");
    const second = registry.start("repository-b");
    registry.stopAll();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(registry.getState("repository-a")).toBe("idle");
    expect(registry.getState("repository-b")).toBe("idle");
  });

  it("preserves the shell-independent CLI cancellation exit contract", () => {
    expect(EXIT_CODES.cancelled).toBe(130);
  });
});
