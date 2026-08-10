import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("MCP and VS Code integration documentation", () => {
  it("validates the local stdio MCP configuration and bounds", async () => {
    const source = await readFile(
      resolve(root, "docs/integrations/mcp.md"),
      "utf8",
    );
    const configuration = source.match(/```json\n([^\n]+)\n```/)?.[1];
    expect(JSON.parse(configuration ?? "null")).toEqual({
      command: "fuzit-mcp",
      args: ["/absolute/path/to/workspace"],
      transport: "stdio",
    });
    for (const contract of [
      "at most eight roots",
      "30 seconds",
      "2 MB",
      "No network port is opened",
      "no shell wrapper",
      "fails before tool work begins",
    ]) {
      expect(source).toContain(contract);
    }
  });

  it("matches documented VS Code commands to the extension manifest", async () => {
    const [source, manifestText] = await Promise.all([
      readFile(resolve(root, "docs/integrations/vscode.md"), "utf8"),
      readFile(resolve(root, "apps/vscode-extension/package.json"), "utf8"),
    ]);
    const manifest = JSON.parse(manifestText) as {
      activationEvents: string[];
      contributes: { commands: { command: string; title: string }[] };
    };
    for (const event of manifest.activationEvents) {
      expect(source).toContain(`\`${event}\``);
    }
    for (const command of manifest.contributes.commands) {
      expect(source).toContain(`\`${command.title}\``);
    }
  });

  it("keeps installation owner-authorized and trust failures explicit", async () => {
    const source = await readFile(
      resolve(root, "docs/integrations/vscode.md"),
      "utf8",
    );
    expect(source).toContain("code --install-extension");
    expect(source).toContain("not published");
    expect(source).toContain("refuse work in an untrusted workspace");
    expect(source).not.toMatch(/https?:\/\/[^\s)]+\.(?:vsix|tgz)/);
  });
});
