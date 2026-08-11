import { describe, expect, it } from "vitest";

import {
  box,
  formatGraphBuild,
  formatGraphStats,
  formatHumanValue,
  resolveTheme,
} from "../src/output/presentation.js";

const ascii = resolveTheme({ color: false, unicode: false });
const unicode = resolveTheme({ color: false, unicode: true });

// ---------------------------------------------------------------------------
// box() — border rendering
// ---------------------------------------------------------------------------

describe("box() border rendering", () => {
  it("ASCII: top border uses - repeated to full width", () => {
    const output = box(ascii, "TITLE", ["body"]);
    const lines = output.split("\n");
    // "+---...---+" where interior width >= title.length + 2
    expect(lines[0]).toMatch(/^\+[-]+\+$/);
    // width must match body lines
    expect(lines[0].length).toBe(lines[1].length);
  });

  it("ASCII: bottom border uses - repeated to full width", () => {
    const output = box(ascii, "TITLE", ["body"]);
    const lines = output.split("\n");
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toMatch(/^\+[-]+\+$/);
    expect(lastLine.length).toBe(lines[0].length);
  });

  it("Unicode: top border repeats ─ to the full width", () => {
    const output = box(unicode, "TITLE", ["body"]);
    const lines = output.split("\n");
    const top = lines[0];
    // must start with ╭ and end with ╮
    expect(top.startsWith("╭")).toBe(true);
    expect(top.endsWith("╮")).toBe(true);
    // the fill between ╭ and ╮ must be all ─ (U+2500)
    const fill = top.slice(1, -1);
    expect(fill).toMatch(/^─+$/);
    // fill length must equal the body/title width
    const bodyLine = lines[2]; // "│ body... │"
    expect(top.length).toBe(bodyLine.length);
  });

  it("Unicode: bottom border repeats ─ to the full width", () => {
    const output = box(unicode, "TITLE", ["body"]);
    const lines = output.split("\n");
    const bottom = lines[lines.length - 1];
    expect(bottom.startsWith("╰")).toBe(true);
    expect(bottom.endsWith("╯")).toBe(true);
    const fill = bottom.slice(1, -1);
    expect(fill).toMatch(/^─+$/);
    // bottom must equal top in length
    expect(bottom.length).toBe(lines[0].length);
  });

  it("Unicode: wider body line drives border width, not title", () => {
    const longBody = "a very long body line that exceeds the title length";
    const output = box(unicode, "Short", [longBody]);
    const lines = output.split("\n");
    const top = lines[0];
    const fill = top.slice(1, -1);
    // fill should be at least as long as the body line
    expect(fill.length).toBeGreaterThanOrEqual(longBody.length);
  });

  it("Unicode: content does not overflow the border width", () => {
    const body = ["short", "a longer line here", "medium length"];
    const output = box(unicode, "Test Title", body);
    const lines = output.split("\n");
    const topWidth = lines[0].length;
    // every line must have the same width
    for (const line of lines) {
      expect(line.length).toBe(topWidth);
    }
  });

  it("ASCII: all lines have equal width", () => {
    const body = ["short", "a longer body line to test alignment"];
    const output = box(ascii, "Title", body);
    const lines = output.split("\n");
    const topWidth = lines[0].length;
    for (const line of lines) {
      expect(line.length).toBe(topWidth);
    }
  });
});

// ---------------------------------------------------------------------------
// formatGraphStats
// ---------------------------------------------------------------------------

describe("formatGraphStats()", () => {
  const statsRecord = {
    nodes: 5,
    edges: 3,
    nodeKinds: { file: 3, module: 2 },
    edgeKinds: { imports: 3 },
    completeness: "complete",
    diagnostics: [],
  };

  it("renders node and edge counts", () => {
    const output = formatGraphStats(statsRecord, ascii);
    expect(output).toContain("Nodes");
    expect(output).toContain("5");
    expect(output).toContain("Edges");
    expect(output).toContain("3");
  });

  it("renders node kinds breakdown", () => {
    const output = formatGraphStats(statsRecord, ascii);
    expect(output).toContain("Node kinds");
    expect(output).toContain("file");
    expect(output).toContain("module");
  });

  it("renders edge kinds breakdown", () => {
    const output = formatGraphStats(statsRecord, ascii);
    expect(output).toContain("Edge kinds");
    expect(output).toContain("imports");
  });

  it("renders completeness", () => {
    const output = formatGraphStats(statsRecord, ascii);
    expect(output).toContain("Completeness");
    expect(output).toContain("COMPLETE");
  });

  it("renders diagnostics count", () => {
    const output = formatGraphStats(statsRecord, ascii);
    expect(output).toContain("Diagnostics");
    expect(output).toContain("0");
  });
});

// ---------------------------------------------------------------------------
// formatGraphBuild
// ---------------------------------------------------------------------------

describe("formatGraphBuild()", () => {
  const buildRecord = {
    output: "/repo/.fuzit/graph.json",
    nodes: 10,
    edges: 8,
    completeness: "complete",
  };

  it("renders output path", () => {
    const output = formatGraphBuild(buildRecord, ascii);
    expect(output).toContain("/repo/.fuzit/graph.json");
  });

  it("renders node count", () => {
    const output = formatGraphBuild(buildRecord, ascii);
    expect(output).toContain("10");
  });

  it("renders completeness", () => {
    const output = formatGraphBuild(buildRecord, ascii);
    expect(output).toContain("COMPLETE");
  });

  it("shows repository graph title, not Graph Statistics", () => {
    const output = formatGraphBuild(buildRecord, ascii);
    // Box title carries the label; no duplicate inner heading
    expect(output).toContain("Fuzit · Repository Graph");
    expect(output).toContain("Nodes");
    expect(output).toContain("Output");
    expect(output).not.toContain("Graph Statistics");
    // Must not duplicate the title inside the body
    const occurrences = (output.match(/Repository Graph/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// formatHumanValue dispatch — graph kinds
// ---------------------------------------------------------------------------

describe("formatHumanValue() graph routing", () => {
  it("routes kind:graph-stats to graph statistics presentation", () => {
    const result = formatHumanValue(
      {
        kind: "graph-stats",
        nodes: 4,
        edges: 2,
        nodeKinds: { file: 4 },
        edgeKinds: { imports: 2 },
        completeness: "complete",
        diagnostics: [],
      },
      ascii,
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Graph Statistics");
    expect(result).toContain("Node kinds");
    expect(result).not.toContain("Graph built");
  });

  it("routes kind:graph-build to graph build presentation", () => {
    const result = formatHumanValue(
      {
        kind: "graph-build",
        output: "/tmp/graph.json",
        nodes: 2,
        edges: 1,
        completeness: "complete",
      },
      ascii,
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Fuzit · Repository Graph");
    expect(result).toContain("/tmp/graph.json");
    expect(result).not.toContain("Graph Statistics");
  });

  it("routes kind:graph-query to graph query presentation", () => {
    const result = formatHumanValue(
      {
        kind: "graph-query",
        results: [{ kind: "file", path: "src/a.ts", id: "n1" }],
        diagnostics: [],
        truncated: false,
      },
      ascii,
    );
    expect(result).not.toBeNull();
    expect(result).toContain("Graph Query");
    expect(result).toContain("FILE: src/a.ts");
  });

  it("returns null for unknown object shape (falls back to JSON in router)", () => {
    const result = formatHumanValue({ randomField: 42 }, ascii);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auth presentation — security and wording
// ---------------------------------------------------------------------------

describe("formatHumanValue() auth presentation", () => {
  it("does not expose token values", () => {
    const result = formatHumanValue(
      {
        kind: "auth",
        status: "Authenticated",
        host: "github.com",
        account: "alice",
        source: "GH_TOKEN",
        permission: "Pull requests: read",
      },
      ascii,
    );
    expect(result).not.toBeNull();
    // actual token strings should never appear
    expect(result).not.toContain("ghp_");
    expect(result).not.toContain("Bearer");
  });

  it("permission wording does not imply verified scope possession", () => {
    const result = formatHumanValue(
      {
        kind: "auth",
        status: "Authenticated",
        host: "github.com",
        source: "GH_TOKEN",
        permission: "Pull requests: read",
      },
      ascii,
    );
    expect(result).not.toBeNull();
    // must not say "Verified" or "Permissions" (implying runtime scope check)
    expect(result).not.toMatch(/[Vv]erified\s+[Pp]ermission/);
    // should say "Required" to indicate it is a requirement, not a verified claim
    expect(result).toContain("Required");
  });

  it("JSON auth output does not go through box rendering", () => {
    const result = formatHumanValue(
      {
        kind: "auth",
        status: "Not authenticated",
        host: "github.com",
        source: "anonymous",
      },
      { color: false, unicode: false },
    );
    expect(result).not.toBeNull();
    expect(result).not.toContain("\u001B["); // no ANSI
  });
});

// ---------------------------------------------------------------------------
// P0 Regression: No duplicate headings
// ---------------------------------------------------------------------------

describe("P0 regression: No duplicate inner headings", () => {
  it("formatScan has single title bar, no repeated inner title header", () => {
    const output = formatHumanValue({
      schemaVersion: 1,
      root: "/repo",
      counts: { files: 10, directories: 2, symlinks: 0 },
      status: "complete",
    }, ascii)!;
    expect(output).toContain("Fuzit · Repository Scan");
    const count = (output.match(/Repository Scan/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("formatPack has single title bar, no repeated inner title header", () => {
    const output = formatHumanValue({
      kind: "pack",
      selected: ["a.ts"],
      redactions: { findings: 0, redactedItems: 0, omittedItems: 0 },
      output: "/out.md",
    }, ascii)!;
    expect(output).toContain("Fuzit · Repository Pack");
    const count = (output.match(/Repository Pack/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("formatReview has single title bar, no repeated inner title header", () => {
    const output = formatHumanValue({
      kind: "review",
      repository: "owner/repo",
      prNumber: 42,
    }, ascii)!;
    expect(output).toContain("Fuzit · Pull Request Review");
    const count = (output.match(/Pull Request Review/g) ?? []).length;
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// P1 Human Formatter Coverage
// ---------------------------------------------------------------------------

describe("P1 Human formatters for remaining commands", () => {
  it("formats doctor report in a box via structural fingerprinting", () => {
    const result = formatHumanValue(
      {
        status: "ready",
        checks: [
          { id: "node", status: "pass", message: "Node version 20.0.0" },
          { id: "git", status: "pass", message: "Git available" },
        ],
      },
      ascii,
    )!;
    expect(result).not.toBeNull();
    expect(result).toContain("Environment Check");
    expect(result).toContain("PASS node: Node version 20.0.0");
  });

  it("formats git status", () => {
    const result = formatHumanValue(
      {
        schemaVersion: 1,
        changes: [{ path: "src/main.ts", kind: "modified" }],
      },
      ascii,
    )!;
    expect(result).toContain("Git Status");
    expect(result).toContain("src/main.ts");
  });

  it("formats git log", () => {
    const result = formatHumanValue(
      {
        schemaVersion: 1,
        entries: [
          { hash: "abc123456789", author: "Alice", message: "feat: add CLI" },
        ],
      },
      ascii,
    )!;
    expect(result).toContain("Git Log");
    expect(result).toContain("abc12345");
    expect(result).toContain("Alice");
  });

  it("formats config show", () => {
    const result = formatHumanValue(
      {
        schemaVersion: 1,
        values: { maxFiles: 120, outputFormat: "markdown" },
        provenance: { maxFiles: "default", outputFormat: "cli" },
      },
      ascii,
    )!;
    expect(result).toContain("Effective Configuration");
    expect(result).toContain("maxFiles");
    expect(result).toContain("120");
  });

  it("formats context result", () => {
    const result = formatHumanValue(
      {
        output: "/tmp/context.md",
        selected: ["a.ts", "b.ts"],
        report: { budgetTokens: 1000, usedTokens: 500 },
      },
      ascii,
    )!;
    expect(result).toContain("Task Context");
    expect(result).toContain("Selected files     2");
  });

  it("formats review metadata and findings cleanly", () => {
    const result = formatHumanValue(
      {
        kind: "review",
        repository: "fuzit/fuzit",
        prNumber: 99,
        title: "Fix box borders",
        state: "open",
        author: "bob",
        baseRef: "main",
        headRef: "patch-1",
        findings: [
          { severity: "warning", message: "Missing error check" },
        ],
      },
      ascii,
    )!;
    expect(result).toContain("fuzit/fuzit");
    expect(result).toContain("#99");
    expect(result).toContain("Fix box borders");
    expect(result).toContain("main ← patch-1");
    expect(result).toContain("WARNING Missing error check");
  });
});

// ---------------------------------------------------------------------------
// P2 Box hardening: Display width & Windows paths
// ---------------------------------------------------------------------------

describe("P2 Box hardening and width safety", () => {
  it("truncates extremely long paths so box border does not exceed MAX_BOX_INNER_WIDTH", () => {
    const longPath = "C:\\Users\\very-long-user-name\\AppData\\Local\\Deeply\\Nested\\Directory\\Path\\That\\Is\\Extremely\\Long\\Project\\File.ts";
    const result = formatHumanValue(
      {
        kind: "review",
        repository: longPath,
        prNumber: 1,
      },
      ascii,
    )!;
    const lines = result.split("\n");
    const topWidth = lines[0].length;
    // max inner width is 76, total line length including borders (+ 4) is 80
    expect(topWidth).toBeLessThanOrEqual(80);
    for (const line of lines) {
      expect(line.length).toBe(topWidth);
    }
  });

  it("safely handles Windows backslashes in path fields", () => {
    const winPath = "C:\\projects\\fuzit\\apps\\cli\\src\\index.ts";
    const result = formatHumanValue(
      {
        output: winPath,
        selected: [winPath],
        report: { budgetTokens: 500, usedTokens: 200 },
      },
      ascii,
    )!;
    expect(result).toContain("C:\\projects\\fuzit\\apps");
  });
});
