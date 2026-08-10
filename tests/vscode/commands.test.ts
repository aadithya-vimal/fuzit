import { describe, it, expect } from "vitest";
import {
  initializeWorkspaceCommand,
  runDoctorCommand,
} from "../../apps/vscode-extension/src/commands.js";

const root = process.cwd();

describe("VS Code Extension Commands (V1-092)", () => {
  describe("Workspace Trust Enforcement", () => {
    it("rejects init command when workspace is untrusted", async () => {
      const result = await initializeWorkspaceCommand({
        isTrusted: false,
        workspaceRoot: root,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects doctor command when workspace is untrusted", async () => {
      const result = await runDoctorCommand({
        isTrusted: false,
        workspaceRoot: root,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("Workspace Trust is required");
    });

    it("rejects init command when workspace root is empty", async () => {
      const result = await initializeWorkspaceCommand({
        isTrusted: true,
        workspaceRoot: "",
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("No workspace root selected");
    });
  });

  describe("Doctor Command Execution", () => {
    it("runs doctor checks and redacts absolute root paths", async () => {
      const result = await runDoctorCommand({
        isTrusted: true,
        workspaceRoot: root,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as {
          checks: { metadata?: Record<string, unknown> }[];
        };
        expect(data.checks).toBeDefined();
        for (const check of data.checks) {
          if (check.metadata) {
            for (const val of Object.values(check.metadata)) {
              if (typeof val === "string") {
                expect(val).not.toContain(root);
              }
            }
          }
        }
      }
    });
  });
});
