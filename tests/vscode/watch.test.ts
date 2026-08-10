import { describe, it, expect } from "vitest";
import {
  WatchRegistry,
  startWatchCommand,
  stopWatchCommand,
} from "../../apps/vscode-extension/src/watch.js";

const root = process.cwd();

describe("Watch Controls (V1-095)", () => {
  describe("WatchRegistry", () => {
    it("starts idle state for unknown root", () => {
      const reg = new WatchRegistry();
      expect(reg.getState(root)).toBe("idle");
      expect(reg.isWatching(root)).toBe(false);
    });

    it("transitions to running state after start()", () => {
      const reg = new WatchRegistry();
      reg.start(root);
      expect(reg.isWatching(root)).toBe(true);
      expect(reg.getState(root)).toBe("running");
      reg.stop(root);
    });

    it("prevents duplicate watchers for same root", () => {
      const reg = new WatchRegistry();
      reg.start(root);
      expect(() => reg.start(root)).toThrow(/already running/);
      reg.stop(root);
    });

    it("transitions back to idle after stop()", () => {
      const reg = new WatchRegistry();
      reg.start(root);
      reg.stop(root);
      expect(reg.isWatching(root)).toBe(false);
      expect(reg.getState(root)).toBe("idle");
    });

    it("stopAll() cleans up all active watchers (deactivation cleanup)", () => {
      const reg = new WatchRegistry();
      const root2 = `${root}/a`;
      reg.start(root);
      reg.start(root2);
      expect(reg.isWatching(root)).toBe(true);
      expect(reg.isWatching(root2)).toBe(true);
      reg.stopAll();
      expect(reg.isWatching(root)).toBe(false);
      expect(reg.isWatching(root2)).toBe(false);
    });
  });

  describe("startWatchCommand", () => {
    it("rejects when workspace is untrusted", async () => {
      const reg = new WatchRegistry();
      const result = await startWatchCommand(reg, root, false);
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects when root is empty", async () => {
      const reg = new WatchRegistry();
      const result = await startWatchCommand(reg, "", true);
      expect(result.ok).toBe(false);
      expect(result.message).toContain("No workspace root selected");
    });

    it("succeeds for trusted workspace and valid root", async () => {
      const reg = new WatchRegistry();
      const result = await startWatchCommand(reg, root, true);
      expect(result.ok).toBe(true);
      expect(reg.isWatching(root)).toBe(true);
      reg.stop(root);
    });

    it("rejects starting a duplicate watcher", async () => {
      const reg = new WatchRegistry();
      await startWatchCommand(reg, root, true);
      const result = await startWatchCommand(reg, root, true);
      expect(result.ok).toBe(false);
      expect(result.message).toContain("already active");
      reg.stop(root);
    });
  });

  describe("stopWatchCommand", () => {
    it("returns error when no active watcher exists", () => {
      const reg = new WatchRegistry();
      const result = stopWatchCommand(reg, root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain("No active watcher");
    });

    it("stops an active watcher cleanly", async () => {
      const reg = new WatchRegistry();
      await startWatchCommand(reg, root, true);
      const result = stopWatchCommand(reg, root);
      expect(result.ok).toBe(true);
      expect(reg.isWatching(root)).toBe(false);
    });
  });
});
