import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PermissionBroker } from "@fuzit/plugin-host";

describe("Permission Broker & Security Authorization (V1-105)", () => {
  const workspaceRoot = resolve(process.cwd());

  it("enforces deny-by-default for unconfigured filesystem operations", () => {
    const broker = new PermissionBroker({ workspaceRoot });

    const readResult = broker.authorize({
      kind: "filesystem:read",
      path: "src/index.ts",
    });
    expect(readResult.allowed).toBe(false);
    expect(readResult.reason).toContain("deny by default");

    const writeResult = broker.authorize({
      kind: "filesystem:write",
      path: "dist/out.js",
    });
    expect(writeResult.allowed).toBe(false);
  });

  it("blocks path traversal and null byte attack attempts (confused deputy defense)", () => {
    const broker = new PermissionBroker({
      workspaceRoot,
      permissions: {
        filesystem: {
          readPaths: ["src"],
        },
      },
    });

    const traversalResult = broker.authorize({
      kind: "filesystem:read",
      path: "src/../../etc/passwd",
    });
    expect(traversalResult.allowed).toBe(false);
    expect(traversalResult.reason).toContain(
      "Path traversal '..' is strictly forbidden",
    );

    const nullByteResult = broker.authorize({
      kind: "filesystem:read",
      path: "src/index.ts\0.png",
    });
    expect(nullByteResult.allowed).toBe(false);
    expect(nullByteResult.reason).toContain("Path contains null bytes");
  });

  it("authorizes allowed filesystem paths when explicitly granted", () => {
    const broker = new PermissionBroker({
      workspaceRoot,
      permissions: {
        filesystem: {
          readPaths: ["src"],
          writePaths: ["dist"],
        },
      },
    });

    const readResult = broker.authorize({
      kind: "filesystem:read",
      path: join(workspaceRoot, "src", "main.ts"),
    });
    expect(readResult.allowed).toBe(true);

    const writeResult = broker.authorize({
      kind: "filesystem:write",
      path: join(workspaceRoot, "dist", "bundle.js"),
    });
    expect(writeResult.allowed).toBe(true);
  });

  it("enforces network host whitelist and shell/env/credential access controls", () => {
    const broker = new PermissionBroker({
      workspaceRoot,
      permissions: {
        network: {
          allowedHosts: ["api.github.com"],
        },
        shell: false,
        environment: {
          allowedVars: ["NODE_ENV"],
        },
        credentials: {
          allowedKeys: ["GITHUB_TOKEN"],
        },
      },
    });

    expect(
      broker.authorize({ kind: "network:connect", host: "api.github.com" })
        .allowed,
    ).toBe(true);
    expect(
      broker.authorize({ kind: "network:connect", host: "malicious.com" })
        .allowed,
    ).toBe(false);

    expect(
      broker.authorize({ kind: "shell:execute", command: "whoami" }).allowed,
    ).toBe(false);

    expect(
      broker.authorize({ kind: "environment:read", varName: "NODE_ENV" })
        .allowed,
    ).toBe(true);
    expect(
      broker.authorize({ kind: "environment:read", varName: "SECRET_KEY" })
        .allowed,
    ).toBe(false);

    expect(
      broker.authorize({ kind: "credentials:read", key: "GITHUB_TOKEN" })
        .allowed,
    ).toBe(true);
    expect(
      broker.authorize({
        kind: "credentials:read",
        key: "AWS_SECRET_ACCESS_KEY",
      }).allowed,
    ).toBe(false);
  });

  it("maintains a complete audit log of all authorization decisions", () => {
    const broker = new PermissionBroker({ workspaceRoot });
    broker.authorize({ kind: "shell:execute", command: "ls" });
    broker.authorize({ kind: "runtime:spawnProcess" });

    const auditLogs = broker.getAuditLogs();
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[0]?.operation.kind).toBe("shell:execute");
    expect(auditLogs[0]?.allowed).toBe(false);
    expect(auditLogs[1]?.operation.kind).toBe("runtime:spawnProcess");
    expect(auditLogs[1]?.allowed).toBe(false);
  });
});
