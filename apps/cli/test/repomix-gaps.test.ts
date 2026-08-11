import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  compressCodeContent,
  removeComments,
  removeEmptyLines,
  addLineNumbers,
  transformCodeContent,
  parseByteSize,
  splitPackedOutput,
} from "@fuzit/core";
import { runCli } from "../src/cli.js";

async function captureRun(args: readonly string[], root: string) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    args,
    {
      writeOut: (val) => {
        stdout += val;
      },
      writeErr: (val) => {
        stderr += val;
      },
    },
    { repositoryRoot: root, environment: {} },
  );
  return { exitCode, stdout, stderr };
}

describe("Repomix Gaps Feature Suite", () => {
  describe("Code transformations & compression", () => {
    it("removeComments strips single and multi-line comments", () => {
      const code = `// header comment\nfunction test() {\n  /* inner comment */\n  return 42;\n}`;
      const cleaned = removeComments(code, "test.ts");
      expect(cleaned).not.toContain("header comment");
      expect(cleaned).not.toContain("inner comment");
      expect(cleaned).toContain("function test()");
    });

    it("removeEmptyLines removes blank lines", () => {
      const code = "a\n\n\nb\n\nc";
      const cleaned = removeEmptyLines(code);
      expect(cleaned).toBe("a\nb\nc");
    });

    it("addLineNumbers prepends 1-indexed line numbers", () => {
      const code = "first\nsecond";
      const numbered = addLineNumbers(code);
      expect(numbered).toContain("1 | first");
      expect(numbered).toContain("2 | second");
    });

    it("compressCodeContent skeletonizes code bodies", () => {
      const code = `export function add(a: number, b: number): number {\n  const res = a + b;\n  return res;\n}`;
      const compressed = compressCodeContent(code, "math.ts");
      expect(compressed).toContain("export function add");
      expect(compressed).toContain("implementation hidden");
      expect(compressed).not.toContain("const res = a + b");
    });
  });

  describe("Split output & size parsing", () => {
    it("parseByteSize handles kb, mb, and raw bytes", () => {
      expect(parseByteSize("500kb")).toBe(500 * 1024);
      expect(parseByteSize("1mb")).toBe(1024 * 1024);
      expect(parseByteSize("1000")).toBe(1000);
    });

    it("splitPackedOutput chunks large content into multiple output files", () => {
      const content = "line 1\nline 2\nline 3\nline 4\nline 5";
      const chunks = splitPackedOutput(content, "/tmp/out.md", 15);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]!.filename).toContain("_part1.md");
    });
  });

  describe("Pack CLI command extensions", () => {
    it("filters files by --include and --ignore patterns", async () => {
      const root = await mkdtemp(join(tmpdir(), "fuzit-pack-patterns-"));
      try {
        await writeFile(join(root, "app.ts"), "export const a = 1;");
        await writeFile(join(root, "test.spec.ts"), "describe('test', () => {});");

        const result = await captureRun(
          ["--json", "pack", "--root", root, "--format", "markdown", "--output", "-", "--ignore", "*.spec.ts"],
          root,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("app.ts");
        expect(result.stdout).not.toContain("## test.spec.ts");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("supports code transformation flags on pack", async () => {
      const root = await mkdtemp(join(tmpdir(), "fuzit-pack-transform-"));
      try {
        await writeFile(
          join(root, "service.ts"),
          "// comment\nexport function service() {\n  return 'ok';\n}",
        );

        const result = await captureRun(
          ["--json", "pack", "--root", root, "--format", "markdown", "--output", "-", "--remove-comments", "--line-numbers"],
          root,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("// comment");
        expect(result.stdout).toContain("1 |");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("MCP and Agent Skills CLI extension", () => {
    it("plugin mcp returns MCP server configuration", async () => {
      const root = await mkdtemp(join(tmpdir(), "fuzit-mcp-"));
      try {
        const result = await captureRun(["--json", "plugin", "mcp"], root);
        expect(result.exitCode).toBe(0);
        const parsed = JSON.parse(result.stdout) as { mcpServers: { fuzit: { command: string } } };
        expect(parsed.mcpServers.fuzit.command).toBe("fuzit");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("init --mcp initializes MCP config and Agent Skills", async () => {
      const root = await mkdtemp(join(tmpdir(), "fuzit-init-mcp-"));
      try {
        const result = await captureRun(["init", "--mcp", "--dry-run"], root);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(".vscode/mcp.json");
        expect(result.stdout).toContain(".agents/skills/fuzit-pack/SKILL.md");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
