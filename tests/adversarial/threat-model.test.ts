import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requiredSurfaces = [
  "discovery and configuration",
  "scanner and security filter",
  "incremental index and watcher",
  "analysis and graph",
  "CLI and renderers",
  "MCP server",
  "VS Code extension",
  "plugin SDK and host",
  "logs, crash output, support bundles, and archives",
  "packaging and release",
] as const;

function threatRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\| TM-\d{2} \|/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

describe("V1 threat-model traceability", () => {
  it("maps every V1 attack surface to controls, tests, ownership, risk, and a blocker", async () => {
    const markdown = await readFile(
      resolve("docs/security/threat-model.md"),
      "utf8",
    );
    const rows = threatRows(markdown);

    expect(rows.map((row) => row[0])).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `TM-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(rows.map((row) => row[1])).toEqual(requiredSurfaces);
    for (const row of rows) {
      expect(row).toHaveLength(8);
      for (const evidence of row.slice(2))
        expect(evidence.length).toBeGreaterThan(8);
    }
  });

  it("fails traceability for a critical threat with missing evidence", () => {
    const incomplete =
      "| TM-01 | plugins | escape | deny |  | owner | risk | blocker |";
    const [row] = threatRows(incomplete);
    expect(row).toBeDefined();
    expect(row?.[4]).toBe("");
    expect(row?.every((cell) => cell.length > 0)).toBe(false);
  });
});
