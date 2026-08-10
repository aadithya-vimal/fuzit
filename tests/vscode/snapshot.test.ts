import { describe, it, expect } from "vitest";
import {
  createSnapshotCommand,
  diffSnapshotCommand,
  graphNeighborsCommand,
  cacheStatusCommand,
} from "../../apps/vscode-extension/src/snapshot.js";

const root = process.cwd();

describe("Snapshot, Diff, Graph, and Cache Commands (V1-096)", () => {
  describe("createSnapshotCommand", () => {
    it("rejects when workspace is untrusted", async () => {
      const result = await createSnapshotCommand({
        isTrusted: false,
        workspaceRoot: root,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects when workspace root is empty", async () => {
      const result = await createSnapshotCommand({
        isTrusted: true,
        workspaceRoot: "",
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("No workspace root selected");
    });

    it("returns error for missing CLI binary", async () => {
      const result = await createSnapshotCommand({
        isTrusted: true,
        workspaceRoot: root,
        cliPath: "nonexistent-fuzit-snap-1234",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("diffSnapshotCommand", () => {
    it("rejects when workspace is untrusted", async () => {
      const result = await diffSnapshotCommand(
        { isTrusted: false, workspaceRoot: root },
        "snap-a",
        "snap-b",
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects when either snapshot ID is empty", async () => {
      const result = await diffSnapshotCommand(
        { isTrusted: true, workspaceRoot: root },
        "",
        "snap-b",
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Two snapshot IDs are required");
    });
  });

  describe("graphNeighborsCommand", () => {
    it("rejects when workspace is untrusted", async () => {
      const result = await graphNeighborsCommand(
        { isTrusted: false, workspaceRoot: root },
        "src/index.ts",
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects when file path is empty", async () => {
      const result = await graphNeighborsCommand(
        { isTrusted: true, workspaceRoot: root },
        "",
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("file path is required");
    });
  });

  describe("cacheStatusCommand", () => {
    it("rejects when workspace is untrusted", async () => {
      const result = await cacheStatusCommand({
        isTrusted: false,
        workspaceRoot: root,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("returns error for missing CLI binary", async () => {
      const result = await cacheStatusCommand({
        isTrusted: true,
        workspaceRoot: root,
        cliPath: "nonexistent-fuzit-cache-1234",
      });
      expect(result.ok).toBe(false);
    });
  });
});
