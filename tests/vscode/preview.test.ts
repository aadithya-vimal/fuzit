import { describe, it, expect } from "vitest";
import {
  redactAbsolutePaths,
  renderPreview,
  writeToOutputChannel,
} from "../../apps/vscode-extension/src/preview.js";

const root = process.cwd();

describe("Preview Renderer (V1-094)", () => {
  describe("redactAbsolutePaths", () => {
    it("replaces workspace root occurrences with <root>", () => {
      const output = `Error in ${root}/src/index.ts at line 42`;
      const redacted = redactAbsolutePaths(output, root);
      expect(redacted).toContain("<root>");
      expect(redacted).not.toContain(root);
    });

    it("handles content without workspace root unchanged", () => {
      const output = "No paths here — just clean output.";
      expect(redactAbsolutePaths(output, root)).toBe(output);
    });

    it("handles malicious diagnostic text without crashing", () => {
      const malicious = `<script>alert('xss')</script> ${root} \0 \r\n `;
      const redacted = redactAbsolutePaths(malicious, root);
      expect(redacted).toContain("<root>");
      expect(redacted).not.toContain(root);
    });

    it("returns unchanged content when workspaceRoot is empty", () => {
      const content = "some content /usr/local/share";
      expect(redactAbsolutePaths(content, "")).toBe(content);
    });
  });

  describe("renderPreview", () => {
    it("returns redacted output within size cap unchanged", () => {
      const content = `File found at ${root}/index.ts`;
      const result = renderPreview(content, { workspaceRoot: root });
      expect(result).toContain("<root>");
      expect(result).not.toContain(root);
      expect(result).not.toContain("truncated");
    });

    it("truncates output exceeding size cap", () => {
      const big = "x".repeat(600 * 1024); // 600 KB
      const result = renderPreview(big, {
        workspaceRoot: root,
        maxOutputBytes: 512 * 1024,
      });
      expect(result).toContain("Output truncated");
    });
  });

  describe("writeToOutputChannel", () => {
    it("clears, appends redacted content, and shows the channel", () => {
      const lines: string[] = [];
      let cleared = false;
      let shown = false;

      const channel = {
        clear() {
          cleared = true;
        },
        appendLine(msg: string) {
          lines.push(msg);
        },
        show() {
          shown = true;
        },
      };

      writeToOutputChannel(channel, `Context for ${root}/src/feature.ts`, {
        workspaceRoot: root,
      });

      expect(cleared).toBe(true);
      expect(shown).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join("")).not.toContain(root);
    });
  });
});
