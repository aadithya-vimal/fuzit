import { describe, it, expect } from "vitest";
import {
  scanCommand,
  getContextCommand,
} from "../../apps/vscode-extension/src/commands.js";

const root = process.cwd();

describe("VS Code Extension Scan & Context Commands (V1-093)", () => {
  describe("scanCommand", () => {
    it("rejects scan when workspace is untrusted", async () => {
      const result = await scanCommand({
        isTrusted: false,
        workspaceRoot: root,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects scan when workspace root is empty", async () => {
      const result = await scanCommand({
        isTrusted: true,
        workspaceRoot: "",
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("No workspace root selected");
    });

    it("returns an error for missing CLI binary", async () => {
      const result = await scanCommand({
        isTrusted: true,
        workspaceRoot: root,
        cliPath: "nonexistent-fuzit-bin-scan-1234",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("getContextCommand", () => {
    it("rejects context when workspace is untrusted", async () => {
      const result = await getContextCommand(
        { isTrusted: false, workspaceRoot: root },
        { task: "refactor auth module" },
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects context when task is empty", async () => {
      const result = await getContextCommand(
        { isTrusted: true, workspaceRoot: root },
        { task: "" },
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain(
        "Task description must be a non-empty string",
      );
    });

    it("rejects context when workspace root is empty", async () => {
      const result = await getContextCommand(
        { isTrusted: true, workspaceRoot: "" },
        { task: "fix bug" },
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("No workspace root selected");
    });

    it("returns an error for missing CLI binary", async () => {
      const result = await getContextCommand(
        {
          isTrusted: true,
          workspaceRoot: root,
          cliPath: "nonexistent-fuzit-bin-context-1234",
        },
        { task: "fix authentication bug" },
      );
      expect(result.ok).toBe(false);
    });
  });
});
