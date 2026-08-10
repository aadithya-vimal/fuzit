import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  fuzitProfiles,
  fuzitStatus,
} from "../../apps/mcp-server/src/tools/status.js";
import {
  fuzitSearch,
  fuzitGetContext,
} from "../../apps/mcp-server/src/tools/context.js";
import { fuzitExplainSelection } from "../../apps/mcp-server/src/tools/explain.js";
import { WorkspaceCache } from "../../apps/mcp-server/src/workspace.js";

const root = process.cwd();
const outsideRoot = resolve(root, "..");
const allowedRoots = [root];
const context = { allowedRoots };
const emptyCache = new WorkspaceCache();

// --- fuzit_status ---
describe("fuzitStatus", () => {
  it("returns doctor report with redacted root paths", async () => {
    const result = await fuzitStatus(root, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const payload = result.payload as {
        checks: { name: string; metadata?: Record<string, unknown> }[];
      };
      expect(payload.checks).toBeDefined();
      expect(Array.isArray(payload.checks)).toBe(true);
      // Ensure root path does not leak in check metadata
      for (const check of payload.checks) {
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

  it("rejects root outside allowed roots", async () => {
    const result = await fuzitStatus(outsideRoot, context);
    expect(result.ok).toBe(false);
  });
});

// --- fuzit_profiles ---
describe("fuzitProfiles", () => {
  it("returns built-in profiles list", async () => {
    const result = await fuzitProfiles(context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const payload = result.payload as {
        schemaVersion: number;
        profiles: { id: string }[];
      };
      expect(payload.schemaVersion).toBe(1);
      expect(payload.profiles).toBeDefined();
      expect(payload.profiles.length).toBeGreaterThan(0);
      const ids = payload.profiles.map((p) => p.id);
      expect(ids).toContain("bug-fix");
      expect(ids).toContain("feature-development");
      expect(ids).toContain("code-review");
      expect(ids).toContain("security-audit");
    }
  });
});

// --- fuzit_search ---
describe("fuzitSearch", () => {
  it("rejects empty task", async () => {
    const result = await fuzitSearch({ root, task: "" }, context, emptyCache);
    expect(result.ok).toBe(false);
  });

  it("rejects root outside allowed roots", async () => {
    const result = await fuzitSearch(
      { root: outsideRoot, task: "fix bug" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });

  it("returns bounded results for empty repository", async () => {
    const result = await fuzitSearch(
      { root, task: "fix the authentication bug" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = result.payload as { selected: unknown[] };
      expect(Array.isArray(p.selected)).toBe(true);
    }
  });

  it("uses default profile when profile not provided", async () => {
    const result = await fuzitSearch(
      { root, task: "add feature" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.payload as { profile: string }).profile).toBe(
        "feature-development",
      );
    }
  });

  it("rejects unknown profile", async () => {
    const result = await fuzitSearch(
      { root, task: "add feature", profile: "non-existent-profile" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });
});

// --- fuzit_get_context ---
describe("fuzitGetContext", () => {
  it("returns context structure", async () => {
    const result = await fuzitGetContext(
      { root, task: "implement feature" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = result.payload as { schemaVersion: number; task: string };
      expect(p.schemaVersion).toBe(1);
      expect(p.task).toBe("implement feature");
    }
  });

  it("rejects empty task", async () => {
    const result = await fuzitGetContext(
      { root, task: " " },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects root outside allowed roots", async () => {
    const result = await fuzitGetContext(
      { root: outsideRoot, task: "implement feature" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });

  it("supports explain flag", async () => {
    const result = await fuzitGetContext(
      { root, task: "implement feature", explain: true },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(true);
  });
});

// --- fuzit_explain_selection ---
describe("fuzitExplainSelection", () => {
  it("redacts secret-shaped task strings", async () => {
    const secretLike = "A".repeat(50);
    const result = await fuzitExplainSelection(
      { root, task: secretLike },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The task in the result should not contain the raw 50-char string
      const p = result.payload as { task: string };
      expect(p.task).toContain("<redacted>");
    }
  });

  it("returns evidence structure", async () => {
    const result = await fuzitExplainSelection(
      { root, task: "explain my code" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = result.payload as { evidence: unknown[] };
      expect(Array.isArray(p.evidence)).toBe(true);
    }
  });

  it("rejects empty task", async () => {
    const result = await fuzitExplainSelection(
      { root, task: "" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects root outside allowed roots", async () => {
    const result = await fuzitExplainSelection(
      { root: outsideRoot, task: "explain selection" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });
});
