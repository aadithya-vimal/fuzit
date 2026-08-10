import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PluginHost,
  enforceDiagnosticLimits,
  type PluginClient,
} from "@fuzit/plugin-host";
import type { Diagnostic } from "@fuzit/plugin-sdk";

describe("Resource Limits & Timeout Enforcement (V1-106)", () => {
  let tempDir: string;
  let activeClient: PluginClient | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fuzit-plugin-limits-"));
  });

  afterEach(async () => {
    if (activeClient) {
      activeClient.kill();
      activeClient = undefined;
    }
    await rm(tempDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });

  it("truncates diagnostic arrays exceeding max limit and appends truncation warning", () => {
    const overflowDiagnostics: Diagnostic[] = Array.from(
      { length: 150 },
      (_, i) => ({
        schemaVersion: 1,
        code: `ERR_${i}`,
        severity: "error",
        source: "test",
        message: `Error message ${i}`,
      }),
    );

    const result = enforceDiagnosticLimits(overflowDiagnostics, 100);
    expect(result).toBeDefined();
    expect(result).toHaveLength(100);
    expect(result?.[99]?.code).toBe("PLUGIN_DIAGNOSTIC_TRUNCATED");
    expect(result?.[99]?.severity).toBe("warning");
  });

  it("times out execution requests exceeding timeoutMs and issues cancellation signal", async () => {
    const manifestContent = JSON.stringify({
      schemaVersion: 1,
      id: "com.example.slow-plugin",
      name: "Slow Plugin",
      version: "1.0.0",
      protocol: "fuzit-plugin-v1",
      fuzitVersion: "^1.0.0",
      entryPoint: "worker.js",
      capabilities: ["parser"],
    });

    // Mock worker that hangs on execute request without responding
    const workerScript = `
      import { Buffer } from "node:buffer";

      function sendFrame(msg) {
        const payload = Buffer.from(JSON.stringify(msg), "utf-8");
        const header = Buffer.alloc(4);
        header.writeUInt32BE(payload.length, 0);
        process.stdout.write(Buffer.concat([header, payload]));
      }

      let buffer = Buffer.alloc(0);
      process.stdin.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
          const len = buffer.readUInt32BE(0);
          if (buffer.length < 4 + len) break;
          const payload = buffer.subarray(4, 4 + len);
          buffer = buffer.subarray(4 + len);
          const msg = JSON.parse(payload.toString("utf-8"));

          if (msg.type === "handshake_request") {
            sendFrame({
              requestId: msg.requestId,
              type: "handshake_response",
              success: true,
              acceptedCapabilities: ["parser"]
            });
          } else if (msg.type === "execute_request") {
            // Intentionally do not respond to simulate hang
          }
        }
      });
    `;

    await writeFile(
      join(tempDir, "fuzit-plugin.json"),
      manifestContent,
      "utf-8",
    );
    await writeFile(join(tempDir, "worker.js"), workerScript, "utf-8");

    activeClient = await PluginHost.spawnPlugin({ pluginDir: tempDir });
    expect(activeClient.running).toBe(true);

    const result = await activeClient.executeCapability(
      "parser",
      { file: "test.ts" },
      { timeoutMs: 300 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out after 300ms");
  });
});
