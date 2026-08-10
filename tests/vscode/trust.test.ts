import { describe, it, expect } from "vitest";
import {
  assertTrusted,
  isTrustRefusal,
} from "../../apps/vscode-extension/src/trust.js";

const root = process.cwd();

describe("Workspace Trust Enforcement (V1-097)", () => {
  describe("assertTrusted", () => {
    it("allows trusted context with valid root", () => {
      const result = assertTrusted(
        { isTrusted: true, workspaceRoot: root },
        "scan",
      );
      expect(result.ok).toBe(true);
    });

    it("refuses untrusted context with actionable message", () => {
      const result = assertTrusted(
        { isTrusted: false, workspaceRoot: root },
        "scan repository",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("Workspace Trust is required");
        expect(result.message).toContain("scan repository");
        expect(result.message).toContain("Trust dialog");
      }
    });

    it("refuses when workspaceRoot is empty", () => {
      const result = assertTrusted(
        { isTrusted: true, workspaceRoot: "" },
        "watch",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("No workspace root");
      }
    });

    it("refuses when workspaceRoot is whitespace only", () => {
      const result = assertTrusted(
        { isTrusted: true, workspaceRoot: "   " },
        "watch",
      );
      expect(result.ok).toBe(false);
    });

    it("provides actionable label in refusal message", () => {
      const result = assertTrusted(
        { isTrusted: false, workspaceRoot: root },
        "run MCP server",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("run MCP server");
      }
    });
  });

  describe("isTrustRefusal", () => {
    it("returns true for a refusal result", () => {
      const result = assertTrusted(
        { isTrusted: false, workspaceRoot: root },
        "index workspace",
      );
      expect(isTrustRefusal(result)).toBe(true);
    });

    it("returns false for an allowed result", () => {
      const result = assertTrusted(
        { isTrusted: true, workspaceRoot: root },
        "index workspace",
      );
      expect(isTrustRefusal(result)).toBe(false);
    });
  });

  describe("trust transition scenarios (extension-host trust tests)", () => {
    it("allows a previously refused command once trust is granted", () => {
      const untrustedCtx = { isTrusted: false, workspaceRoot: root };
      const trustedCtx = { isTrusted: true, workspaceRoot: root };

      const before = assertTrusted(untrustedCtx, "run plugin");
      const after = assertTrusted(trustedCtx, "run plugin");

      expect(before.ok).toBe(false);
      expect(after.ok).toBe(true);
    });

    it("refuses every command on trust revocation", () => {
      const labels = ["scan", "watch", "index", "run plugin", "serve MCP"];
      for (const label of labels) {
        const result = assertTrusted(
          { isTrusted: false, workspaceRoot: root },
          label,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.message.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
