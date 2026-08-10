import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const page = resolve(root, "docs/integrations/plugins.md");

describe("plugin system documentation", () => {
  it("tracks every local plugin command", async () => {
    const source = await readFile(page, "utf8");
    for (const command of [
      "list",
      "inspect",
      "validate",
      "enable",
      "disable",
      "doctor",
    ]) {
      expect(source).toContain(`fuzit plugin ${command}`);
    }
  });

  it("makes deny-by-default permissions and failure semantics explicit", async () => {
    const source = (await readFile(page, "utf8")).replace(/\s+/g, " ");
    for (const contract of [
      "shell: false",
      "remain denied",
      "fail closed",
      "attributable bounded diagnostic",
      "16 MB",
      "10-second execution bound",
      "no plugin marketplace",
      "never downloads or executes a plugin by name",
    ]) {
      expect(source).toContain(contract);
    }
  });

  it("keeps the reference fixture aligned with its documented manifest", async () => {
    const [source, manifestText] = await Promise.all([
      readFile(page, "utf8"),
      readFile(
        resolve(root, "examples/plugins/reference/fuzit-plugin.json"),
        "utf8",
      ),
    ]);
    const manifest = JSON.parse(manifestText) as {
      id: string;
      protocol: string;
      capabilities: string[];
    };
    expect(manifest.id).toBe("dev.fuzit.reference");
    expect(source).toContain(manifest.protocol);
    for (const capability of manifest.capabilities) {
      expect(source).toContain(`\`${capability}\``);
    }
  });
});
