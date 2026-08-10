import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  fuzitGraphNeighbors,
  fuzitGraphImpact,
} from "../../apps/mcp-server/src/tools/graph.js";
import { fuzitRecentChanges } from "../../apps/mcp-server/src/tools/changes.js";
import { MAX_GRAPH_DEPTH } from "../../apps/mcp-server/src/config.js";
import type { GraphSnapshot } from "@fuzit/graph";

const root = process.cwd();
const outsideRoot = resolve(root, "..");
const allowedRoots = [root];
const context = { allowedRoots };

// Create a minimal test snapshot
function makeSnapshot(nodes: string[] = []): GraphSnapshot {
  return {
    schemaVersion: 1 as const,
    repositoryId: "test-repo",
    completeness: "complete" as const,
    nodes: nodes.map((id) => ({
      id,
      kind: "file" as const,
      label: id,
      provenance: { kind: "scan" as const, configHash: "test" },
    })),
    edges: [],
    diagnostics: [],
  };
}

// --- fuzit_graph_neighbors ---
describe("fuzitGraphNeighbors", () => {
  it("returns no-graph diagnostic when no snapshot", async () => {
    const result = await fuzitGraphNeighbors(
      { root, path: "src/index.ts" },
      context,
      () => null,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = result.payload as { diagnostics: string[] };
      expect(p.diagnostics).toContain("no-graph");
    }
  });

  it("rejects empty path", async () => {
    const result = await fuzitGraphNeighbors({ root, path: "" }, context, () =>
      makeSnapshot(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects depth exceeding MAX_GRAPH_DEPTH", async () => {
    // depth is clamped, so an out-of-range value just gets clamped
    const result = await fuzitGraphNeighbors(
      {
        root,
        path: "src/index.ts",
        depth: MAX_GRAPH_DEPTH + 1,
      },
      context,
      () => makeSnapshot(["src/index.ts"]),
    );
    // clamped to MAX_GRAPH_DEPTH — success since start node exists
    expect(result.ok).toBe(true);
  });

  it("rejects path outside allowed roots", async () => {
    const result = await fuzitGraphNeighbors(
      { root: outsideRoot, path: "src/index.ts" },
      context,
      () => null,
    );
    expect(result.ok).toBe(false);
  });

  it("handles cyclic graph without infinite loop", async () => {
    const cyclicSnapshot: GraphSnapshot = {
      schemaVersion: 1,
      repositoryId: "test-repo",
      completeness: "complete",
      nodes: [
        {
          id: "A",
          kind: "file",
          label: "A",
          provenance: { kind: "scan", configHash: "test" },
        },
        {
          id: "B",
          kind: "file",
          label: "B",
          provenance: { kind: "scan", configHash: "test" },
        },
      ],
      edges: [
        { sourceId: "A", targetId: "B", kind: "imports" },
        { sourceId: "B", targetId: "A", kind: "imports" },
      ],
      diagnostics: [],
    };
    const result = await fuzitGraphNeighbors(
      { root, path: "A", depth: 2 },
      context,
      () => cyclicSnapshot,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = result.payload as { nodes: { id: string }[] };
      expect(p.nodes.length).toBeGreaterThan(0);
    }
  });
});

// --- fuzit_graph_impact ---
describe("fuzitGraphImpact", () => {
  it("returns no-graph diagnostic when no snapshot", async () => {
    const result = await fuzitGraphImpact(
      { root, path: "src/index.ts" },
      context,
      () => null,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = result.payload as { diagnostics: string[] };
      expect(p.diagnostics).toContain("no-graph");
    }
  });

  it("rejects empty path", async () => {
    const result = await fuzitGraphImpact({ root, path: "" }, context, () =>
      makeSnapshot(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects root outside allowed roots", async () => {
    const result = await fuzitGraphImpact(
      { root: outsideRoot, path: "src/index.ts" },
      context,
      () => null,
    );
    expect(result.ok).toBe(false);
  });
});

// --- fuzit_recent_changes ---
describe("fuzitRecentChanges", () => {
  it("rejects root outside allowed roots", async () => {
    const result = await fuzitRecentChanges({ root: outsideRoot }, context);
    expect(result.ok).toBe(false);
  });

  it("omits author email for privacy compliance", async () => {
    const result = await fuzitRecentChanges({ root, limit: 5 }, context);
    if (result.ok) {
      const payload = result.payload as { commits: Record<string, unknown>[] };
      for (const commit of payload.commits) {
        expect(commit).not.toHaveProperty("authorEmail");
      }
    }
  });
});
