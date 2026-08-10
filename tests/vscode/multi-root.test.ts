import { describe, it, expect } from "vitest";
import {
  formatWorkspaceRootPicks,
  resolveWorkspaceRoot,
  PerRootStateManager,
  CancellableTaskRunner,
  type WorkspaceFolderLike,
  type ProgressReport,
} from "../../apps/vscode-extension/src/multi-root.js";

describe("VS Code Extension Multi-Root & Cancellation (V1-098)", () => {
  describe("Root Picker & Disambiguation", () => {
    it("disambiguates two roots with the same basename", () => {
      const folderA: WorkspaceFolderLike = {
        name: "fuzit-app",
        uri: { fsPath: "/workspace/team-a/fuzit-app" },
      };
      const folderB: WorkspaceFolderLike = {
        name: "fuzit-app",
        uri: { fsPath: "/workspace/team-b/fuzit-app" },
      };

      const picks = formatWorkspaceRootPicks([folderA, folderB]);

      expect(picks).toHaveLength(2);
      expect(picks[0].label).toBe("fuzit-app");
      expect(picks[0].description).toBe("/workspace/team-a/fuzit-app");
      expect(picks[1].label).toBe("fuzit-app");
      expect(picks[1].description).toBe("/workspace/team-b/fuzit-app");
    });

    it("does not add description when root names are unique", () => {
      const folderA: WorkspaceFolderLike = {
        name: "frontend",
        uri: { fsPath: "/workspace/frontend" },
      };
      const folderB: WorkspaceFolderLike = {
        name: "backend",
        uri: { fsPath: "/workspace/backend" },
      };

      const picks = formatWorkspaceRootPicks([folderA, folderB]);

      expect(picks[0].description).toBeUndefined();
      expect(picks[1].description).toBeUndefined();
    });

    it("resolves workspace root based on single folder or preference", () => {
      const folderA: WorkspaceFolderLike = {
        name: "proj",
        uri: { fsPath: "C:\\projects\\alpha\\proj" },
      };
      const folderB: WorkspaceFolderLike = {
        name: "proj",
        uri: { fsPath: "C:\\projects\\beta\\proj" },
      };

      expect(resolveWorkspaceRoot([])).toBeNull();
      expect(resolveWorkspaceRoot([folderA])).toEqual(folderA);
      expect(resolveWorkspaceRoot([folderA, folderB])).toBeNull();
      expect(
        resolveWorkspaceRoot([folderA, folderB], "c:/projects/beta/proj"),
      ).toEqual(folderB);
    });
  });

  describe("Per-Root State Isolation", () => {
    it("maintains separate outputs and caches for distinct roots", () => {
      const manager = new PerRootStateManager();
      const rootA = "C:\\Repo\\RootA";
      const rootB = "C:\\Repo\\RootB";

      manager.appendOutput(rootA, "Output A1");
      manager.appendOutput(rootB, "Output B1");
      manager.setCache(rootA, "key1", { data: "A" });
      manager.setCache(rootB, "key1", { data: "B" });

      expect(manager.getOutputs(rootA)).toEqual(["Output A1"]);
      expect(manager.getOutputs(rootB)).toEqual(["Output B1"]);
      expect(manager.getCache(rootA, "key1")).toEqual({ data: "A" });
      expect(manager.getCache(rootB, "key1")).toEqual({ data: "B" });

      manager.clearCache(rootA);
      expect(manager.getCache(rootA, "key1")).toBeUndefined();
      expect(manager.getCache(rootB, "key1")).toEqual({ data: "B" });
    });

    it("normalizes root paths for consistent lookup across Windows and POSIX separators", () => {
      const manager = new PerRootStateManager();
      manager.appendOutput("C:\\User\\Project\\", "log entry");

      expect(manager.getOutputs("c:/User/Project")).toEqual(["log entry"]);
    });
  });

  describe("Cancellable Progress & Concurrent Execution", () => {
    it("executes tasks with progress reports successfully", async () => {
      const runner = new CancellableTaskRunner();
      const progressLog: ProgressReport[] = [];

      const result = await runner.runTask(
        "/workspace/root1",
        "scanTask",
        async (signal, report) => {
          report({ message: "Scanning files...", increment: 50 });
          report({ message: "Analyzing AST...", increment: 50 });
          return { scannedFiles: 42 };
        },
        (report) => progressLog.push(report),
      );

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ scannedFiles: 42 });
      expect(progressLog).toHaveLength(2);
      expect(progressLog[0].message).toBe("Scanning files...");
    });

    it("handles task cancellation cleanly and preserves valid outcome state", async () => {
      const runner = new CancellableTaskRunner();
      const manager = new PerRootStateManager();
      const root = "/workspace/root1";

      const taskPromise = runner.runTask(root, "longTask", async (signal) => {
        manager.appendOutput(root, "Task started");
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal.aborted) {
          throw signal.reason;
        }
        manager.appendOutput(root, "Task finished");
        return "completed";
      });

      // Cancel task while running
      expect(runner.isTaskRunning(root, "longTask")).toBe(true);
      const cancelled = runner.cancelTask(root, "longTask");
      expect(cancelled).toBe(true);

      const result = await taskPromise;
      expect(result.ok).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.message).toContain("cancelled");

      // Verify persistent per-root state remains valid
      expect(manager.getOutputs(root)).toEqual(["Task started"]);
      expect(runner.isTaskRunning(root, "longTask")).toBe(false);
    });

    it("supports concurrent commands across roots with identical basenames", async () => {
      const runner = new CancellableTaskRunner();
      const rootA = "/org/team-1/service";
      const rootB = "/org/team-2/service";

      const [resA, resB] = await Promise.all([
        runner.runTask(rootA, "build", async () => "buildA"),
        runner.runTask(rootB, "build", async () => "buildB"),
      ]);

      expect(resA.ok).toBe(true);
      expect(resA.data).toBe("buildA");
      expect(resB.ok).toBe(true);
      expect(resB.data).toBe("buildB");
    });

    it("handles failure path gracefully", async () => {
      const runner = new CancellableTaskRunner();
      const result = await runner.runTask(
        "/workspace/root1",
        "failingTask",
        async () => {
          throw new Error("Disk full error");
        },
      );

      expect(result.ok).toBe(false);
      expect(result.cancelled).toBeUndefined();
      expect(result.message).toBe("Disk full error");
    });
  });
});
