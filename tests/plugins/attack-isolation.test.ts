import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PermissionBroker,
  PluginHost,
  type PluginClient,
} from "@fuzit/plugin-host";
import {
  MAX_PLUGIN_FRAME_BYTES,
  validatePluginManifest,
  type PluginCapability,
} from "@fuzit/plugin-sdk";

const baseManifest = {
  schemaVersion: 1,
  id: "com.example.attack-fixture",
  name: "Attack Fixture",
  version: "1.0.0",
  protocol: "fuzit-plugin-v1",
  fuzitVersion: "^1.0.0",
  entryPoint: "worker.js",
  capabilities: ["parser"],
} as const;

const workerPrelude = `
  import { Buffer } from "node:buffer";
  function send(message) {
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.length);
    process.stdout.write(Buffer.concat([header, payload]));
  }
  let buffered = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    while (buffered.length >= 4) {
      const size = buffered.readUInt32BE(0);
      if (buffered.length < size + 4) break;
      const message = JSON.parse(buffered.subarray(4, size + 4).toString("utf8"));
      buffered = buffered.subarray(size + 4);
      handle(message);
    }
  });
`;

async function createPlugin(workerBody: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-plugin-attack-"));
  await writeFile(
    join(directory, "fuzit-plugin.json"),
    JSON.stringify(baseManifest),
    "utf8",
  );
  await writeFile(
    join(directory, "worker.js"),
    `${workerPrelude}\n${workerBody}`,
    "utf8",
  );
  return directory;
}

describe("plugin isolation and attack resistance (V1-109)", () => {
  const directories: string[] = [];
  const clients: PluginClient[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.kill();
    for (const directory of directories.splice(0)) {
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100,
      });
    }
  });

  it("rejects unknown capabilities, invalid schemas, protocol mismatch, and traversal", async () => {
    expect(
      validatePluginManifest({
        ...baseManifest,
        capabilities: ["unknown-capability"],
      }).success,
    ).toBe(false);
    expect(
      validatePluginManifest({ ...baseManifest, protocol: 17 }).success,
    ).toBe(false);
    expect(
      validatePluginManifest({ ...baseManifest, entryPoint: "../outside.js" })
        .success,
    ).toBe(false);

    const directory = await createPlugin(`
      function handle(message) {
        if (message.type === "handshake_request") {
          send({ requestId: message.requestId, type: "handshake_response", success: true, acceptedCapabilities: ["parser"] });
        }
      }
    `);
    directories.push(directory);
    const client = await PluginHost.spawnPlugin({ pluginDir: directory });
    clients.push(client);
    const result = await client.executeCapability(
      "unknown-capability" as PluginCapability,
      {},
    );
    expect(result).toEqual({
      success: false,
      error:
        "Capability 'unknown-capability' is not declared in plugin manifest for 'com.example.attack-fixture'",
    });
  });

  it("fails closed on oversized output and attributes a crashing worker", async () => {
    const oversizedDirectory = await createPlugin(`
      function handle(message) {
        if (message.type === "handshake_request") {
          send({ requestId: message.requestId, type: "handshake_response", success: true, acceptedCapabilities: ["parser"] });
        } else if (message.type === "execute_request") {
          const header = Buffer.alloc(4);
          header.writeUInt32BE(${MAX_PLUGIN_FRAME_BYTES + 1});
          process.stdout.write(header);
        }
      }
    `);
    directories.push(oversizedDirectory);
    const oversizedClient = await PluginHost.spawnPlugin({
      pluginDir: oversizedDirectory,
    });
    clients.push(oversizedClient);
    const oversized = await oversizedClient.executeCapability("parser", {});
    expect(oversized.success).toBe(false);
    expect(oversized.error).toContain("Oversized frame header encountered");

    const crashDirectory = await createPlugin(`
      function handle(message) {
        if (message.type === "handshake_request") {
          send({ requestId: message.requestId, type: "handshake_response", success: true, acceptedCapabilities: ["parser"] });
        } else if (message.type === "execute_request") {
          process.exit(23);
        }
      }
    `);
    directories.push(crashDirectory);
    const crashClient = await PluginHost.spawnPlugin({
      pluginDir: crashDirectory,
    });
    clients.push(crashClient);
    const crashed = await crashClient.executeCapability("parser", {});
    expect(crashed.success).toBe(false);
    expect(crashed.error).toContain("code 23");
  });

  it("cancels a hung request without corrupting the next transaction", async () => {
    const directory = await createPlugin(`
      let cancelled = false;
      function handle(message) {
        if (message.type === "handshake_request") {
          send({ requestId: message.requestId, type: "handshake_response", success: true, acceptedCapabilities: ["parser"] });
        } else if (message.type === "cancel_request") {
          cancelled = true;
        } else if (message.type === "execute_request" && cancelled) {
          send({ requestId: message.requestId, type: "execute_response", success: true, data: { isolated: true } });
        }
      }
    `);
    directories.push(directory);
    const client = await PluginHost.spawnPlugin({ pluginDir: directory });
    clients.push(client);

    const timedOut = await client.executeCapability(
      "parser",
      {},
      { timeoutMs: 50 },
    );
    expect(timedOut.success).toBe(false);
    expect(timedOut.error).toContain("timed out after 50ms");

    const isolated = await client.executeCapability(
      "parser",
      {},
      { timeoutMs: 500 },
    );
    expect(isolated).toEqual({
      success: true,
      data: { isolated: true },
      error: undefined,
      diagnostics: undefined,
    });
  });

  it("denies network, filesystem, and shell access without permission grants", () => {
    const broker = new PermissionBroker({ workspaceRoot: resolve(".") });
    const decisions = [
      broker.authorize({ kind: "network:connect", host: "example.com" }),
      broker.authorize({ kind: "filesystem:read", path: "src/index.ts" }),
      broker.authorize({ kind: "filesystem:write", path: "output.json" }),
      broker.authorize({ kind: "shell:execute", command: "echo denied" }),
    ];

    expect(decisions.every((decision) => !decision.allowed)).toBe(true);
    expect(broker.getAuditLogs().map(({ allowed }) => allowed)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
