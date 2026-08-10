import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PluginHost, type PluginClient } from "@fuzit/plugin-host";

describe("Out-of-Process Plugin Host (V1-103)", () => {
  let tempDir: string;
  let activeClient: PluginClient | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fuzit-plugin-test-"));
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

  it("spawns worker process, performs handshake, and executes capability cleanly", async () => {
    const manifestContent = JSON.stringify({
      schemaVersion: 1,
      id: "com.example.mock-parser",
      name: "Mock Parser Plugin",
      version: "1.0.0",
      protocol: "fuzit-plugin-v1",
      fuzitVersion: "^1.0.0",
      entryPoint: "worker.js",
      capabilities: ["parser"],
    });

    // Mock worker script handling framed handshake and execute requests
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
            sendFrame({
              requestId: msg.requestId,
              type: "execute_response",
              success: true,
              data: { parsed: true, file: msg.payload.file }
            });
          } else if (msg.type === "shutdown_request") {
            sendFrame({
              requestId: msg.requestId,
              type: "shutdown_response",
              success: true
            });
            process.exit(0);
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
    expect(activeClient.pluginManifest.id).toBe("com.example.mock-parser");

    const execResult = await activeClient.executeCapability("parser", {
      file: "src/main.ts",
    });
    expect(execResult.success).toBe(true);
    expect(execResult.data).toEqual({ parsed: true, file: "src/main.ts" });

    await activeClient.shutdown();
    expect(activeClient.running).toBe(false);
  });

  it("handles plugin process crashes cleanly as attributable partial failures leaving host state valid", async () => {
    const manifestContent = JSON.stringify({
      schemaVersion: 1,
      id: "com.example.crashing-plugin",
      name: "Crashing Plugin",
      version: "1.0.0",
      protocol: "fuzit-plugin-v1",
      fuzitVersion: "^1.0.0",
      entryPoint: "worker.js",
      capabilities: ["parser"],
    });

    // Mock worker that crashes immediately on execute request
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
            process.exit(1); // Intentional crash
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

    const execResult = await activeClient.executeCapability("parser", {
      file: "src/main.ts",
    });
    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain("Plugin execution failed");

    expect(activeClient.running).toBe(false);
  });
});
