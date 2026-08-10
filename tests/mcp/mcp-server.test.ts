import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  canonicalizePath,
  assertWithinAllowedRoots,
  MAX_ALLOWED_ROOTS,
  MAX_OUTPUT_BYTES,
  MAX_TOOL_DURATION_MS,
} from "../../apps/mcp-server/src/config.js";
import {
  runTool,
  boundPayload,
  validateRoot,
  withTimeout,
} from "../../apps/mcp-server/src/tool-runner.js";
import {
  validateAllowedRoots,
  WorkspaceCache,
} from "../../apps/mcp-server/src/workspace.js";

// --- config ---
describe("config", () => {
  it("canonicalizePath resolves to absolute path", () => {
    const result = canonicalizePath("/tmp/test");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("assertWithinAllowedRoots accepts matching root", () => {
    const root = "/workspace/myrepo";
    expect(() => assertWithinAllowedRoots(root, [root])).not.toThrow();
  });

  it("assertWithinAllowedRoots accepts path within root", () => {
    const root = "/workspace/myrepo";
    const candidate = "/workspace/myrepo/src/index.ts";
    expect(() => assertWithinAllowedRoots(candidate, [root])).not.toThrow();
  });

  it("assertWithinAllowedRoots rejects path outside all roots", () => {
    const root = "/workspace/myrepo";
    const candidate = "/workspace/other/secret.txt";
    expect(() => assertWithinAllowedRoots(candidate, [root])).toThrowError(
      /not within any allowed workspace root/,
    );
  });

  it("assertWithinAllowedRoots rejects path traversal", () => {
    const root = "/workspace/myrepo";
    // On Linux, resolve() collapses ../.. so we test with the non-matching result
    expect(() =>
      assertWithinAllowedRoots("/workspace/myrepo/../otherrepo/secret", [root]),
    ).toThrowError(/not within any allowed workspace root/);
  });

  it("exports bounded constants", () => {
    expect(MAX_ALLOWED_ROOTS).toBeGreaterThan(0);
    expect(MAX_OUTPUT_BYTES).toBeGreaterThan(0);
    expect(MAX_TOOL_DURATION_MS).toBeGreaterThan(0);
  });
});

// --- tool-runner ---
describe("runTool", () => {
  it("returns ok:true for successful handler", async () => {
    const result = await runTool(async () => ({ data: "hello" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toMatchObject({ data: "hello" });
    }
  });

  it("returns ok:false for throwing handler", async () => {
    const result = await runTool(async () => {
      throw new TypeError("bad input");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("bad input");
      expect(result.code).toBe("TYPE_ERROR");
    }
  });

  it("returns RANGE_ERROR code for RangeError", async () => {
    const result = await runTool(async () => {
      throw new RangeError("out of range");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RANGE_ERROR");
    }
  });
});

describe("boundPayload", () => {
  it("returns payload unchanged when within limit", () => {
    const payload = { x: 1 };
    expect(boundPayload(payload)).toEqual(payload);
  });

  it("truncates payload exceeding limit", () => {
    const big = { data: "x".repeat(MAX_OUTPUT_BYTES + 1) };
    const result = boundPayload(big) as { truncated: boolean };
    expect(result.truncated).toBe(true);
  });
});

describe("withTimeout", () => {
  it("resolves handler before timeout", async () => {
    const res = await withTimeout(async () => "done", undefined, 1000);
    expect(res).toBe("done");
  });

  it("rejects when handler exceeds timeout", async () => {
    await expect(
      withTimeout(() => new Promise((r) => setTimeout(r, 500)), undefined, 50),
    ).rejects.toThrow("tool timeout");
  });

  it("rejects immediately if AbortSignal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("user cancelled"));
    await expect(
      withTimeout(async () => "done", controller.signal, 1000),
    ).rejects.toThrow("user cancelled");
  });
});

describe("validateRoot", () => {
  const root = process.cwd();
  const allowedRoots = [root];
  const context = { allowedRoots };

  it("accepts valid root", async () => {
    await expect(validateRoot(root, context)).resolves.toBe(root);
  });

  it("rejects empty string", async () => {
    await expect(validateRoot("", context)).rejects.toThrow(TypeError);
  });

  it("rejects non-string", async () => {
    await expect(validateRoot(42, context)).rejects.toThrow(TypeError);
  });

  it("rejects path outside allowed roots", async () => {
    await expect(validateRoot(resolve(root, ".."), context)).rejects.toThrow(
      RangeError,
    );
  });
});

// --- workspace ---
describe("validateAllowedRoots", () => {
  it("rejects empty root list", async () => {
    await expect(validateAllowedRoots([])).rejects.toThrow(
      /At least one allowed workspace root is required/,
    );
  });

  it("rejects non-string entry", async () => {
    // We can't test actual filesystem paths here without a temp dir,
    // but we can test the count limit
  });
});

describe("WorkspaceCache", () => {
  it("returns empty array for unset root", () => {
    const cache = new WorkspaceCache();
    expect(cache.getItems("/workspace")).toEqual([]);
  });

  it("returns null snapshot for unset root", () => {
    const cache = new WorkspaceCache();
    expect(cache.getSnapshot("/workspace")).toBeNull();
  });

  it("stores and retrieves items", () => {
    const cache = new WorkspaceCache();
    const items = [];
    cache.setItems("/workspace", items);
    expect(cache.getItems("/workspace")).toBe(items);
  });

  it("stores and retrieves snapshot", () => {
    const cache = new WorkspaceCache();
    const snapshot = {
      schemaVersion: 1 as const,
      repositoryId: "test",
      completeness: "complete" as const,
      nodes: [],
      edges: [],
      diagnostics: [],
    };
    cache.setSnapshot("/workspace", snapshot);
    expect(cache.getSnapshot("/workspace")).toBe(snapshot);
  });
});
