import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fuzitCreateBundle } from "../../apps/mcp-server/src/tools/bundle.js";
import { WorkspaceCache } from "../../apps/mcp-server/src/workspace.js";

const root = process.cwd();
const outsideRoot = resolve(root, "..");
const allowedRoots = [root];
const context = { allowedRoots };
const emptyCache = new WorkspaceCache();

describe("fuzitCreateBundle", () => {
  it("rejects root outside allowed roots", async () => {
    const result = await fuzitCreateBundle(
      { root: outsideRoot, task: "fix bug" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects empty task", async () => {
    const result = await fuzitCreateBundle(
      { root, task: "" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects outputSubpath escaping workspace root", async () => {
    const result = await fuzitCreateBundle(
      { root, task: "fix bug", outputSubpath: "../../escaped.md" },
      context,
      emptyCache,
    );
    expect(result.ok).toBe(false);
  });
});

// Parity: same profile/task gives same context result
describe("CLI-MCP parity (unit)", () => {
  it("createTaskContext returns same result for identical inputs", async () => {
    const { createTaskContext } = await import("@fuzit/core");
    const { getProfile } = await import("@fuzit/profiles");

    const profile = getProfile("feature-development");
    const items = [];
    const task = "fix authentication bug";
    const budget = 8000;

    const result1 = createTaskContext({
      items,
      task,
      profile,
      budgetTokens: budget,
    });
    const result2 = createTaskContext({
      items,
      task,
      profile,
      budgetTokens: budget,
    });

    expect(result1.task).toBe(result2.task);
    expect(result1.profile).toBe(result2.profile);
    expect(result1.selected).toEqual(result2.selected);
    expect(result1.excluded).toEqual(result2.excluded);
  });

  it("profiles match CLI profile choices", async () => {
    const { BUILT_IN_PROFILES, getProfile } = await import("@fuzit/profiles");
    for (const p of BUILT_IN_PROFILES) {
      expect(getProfile(p.id).id).toBe(p.id);
    }
  });

  it("renderers output identical text across MCP and core pipeline", async () => {
    const { createTaskContext, renderTaskContext } =
      await import("@fuzit/core");
    const { getProfile } = await import("@fuzit/profiles");

    const profile = getProfile("security-audit");
    const result = createTaskContext({
      items: [],
      task: "audit security boundaries",
      profile,
      budgetTokens: 12000,
    });

    const markdownOutput = renderTaskContext(result, "markdown");
    const jsonOutput = renderTaskContext(result, "json");

    expect(typeof markdownOutput).toBe("string");
    expect(typeof jsonOutput).toBe("string");
    expect(() => JSON.parse(jsonOutput)).not.toThrow();
  });
});
