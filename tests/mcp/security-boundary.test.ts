import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_OUTPUT_BYTES,
  MAX_TASK_BYTES,
} from "../../apps/mcp-server/src/config.js";
import {
  boundPayload,
  runTool,
  validateRoot,
  validateTask,
  withTimeout,
} from "../../apps/mcp-server/src/tool-runner.js";

describe("MCP canonical security boundary (V1-116)", () => {
  it("rejects workspace escape and oversized requests", async () => {
    const root = process.cwd();
    await expect(
      validateRoot(resolve(root, ".."), { allowedRoots: [root] }),
    ).rejects.toThrow();
    expect(() => validateTask("x".repeat(MAX_TASK_BYTES + 1))).toThrow(
      /byte limit/u,
    );
    expect(
      boundPayload({ raw: "x".repeat(MAX_OUTPUT_BYTES + 1) }),
    ).toMatchObject({ truncated: true });
  });

  it("redacts malicious task strings and audit errors", async () => {
    const secret = "SyntheticMcpSecret123456";
    expect(validateTask(`fix parser; token=${secret}`)).not.toContain(secret);
    const result = await runTool(async () => {
      throw new Error(`plugin audit token=${secret}`);
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("propagates cancellation without returning partial raw data", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled by client"));
    await expect(
      withTimeout(async () => "raw content", controller.signal),
    ).rejects.toThrow("cancelled by client");
  });
});
