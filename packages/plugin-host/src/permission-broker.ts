import { isAbsolute, normalize, resolve } from "node:path";
import type { PluginPermissions } from "@fuzit/plugin-sdk";
import { redactSensitiveText } from "@fuzit/security";

export type PermissionOperation =
  | { readonly kind: "filesystem:read"; readonly path: string }
  | { readonly kind: "filesystem:write"; readonly path: string }
  | { readonly kind: "network:connect"; readonly host: string }
  | { readonly kind: "shell:execute"; readonly command: string }
  | { readonly kind: "environment:read"; readonly varName: string }
  | { readonly kind: "credentials:read"; readonly key: string }
  | { readonly kind: "runtime:spawnProcess" }
  | { readonly kind: "persistence:write"; readonly key: string };

export interface PermissionAuditRecord {
  readonly timestamp: string;
  readonly operation: PermissionOperation;
  readonly allowed: boolean;
  readonly reason: string;
}

export interface PermissionBrokerOptions {
  readonly permissions?: PluginPermissions | undefined;
  readonly workspaceRoot?: string | undefined;
}

export class PermissionBroker {
  private readonly permissions: PluginPermissions | undefined;
  private readonly workspaceRoot: string;
  private readonly auditLogs: PermissionAuditRecord[] = [];

  constructor(options?: PermissionBrokerOptions) {
    this.permissions = options?.permissions;
    this.workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
  }

  public getAuditLogs(): readonly PermissionAuditRecord[] {
    return [...this.auditLogs];
  }

  /**
   * Authorize a requested plugin operation against deny-by-default security policies.
   */
  public authorize(operation: PermissionOperation): {
    allowed: boolean;
    reason: string;
  } {
    let result: { allowed: boolean; reason: string };

    switch (operation.kind) {
      case "filesystem:read":
        result = this.authorizePath(
          operation.path,
          this.permissions?.filesystem?.readPaths,
          "read",
        );
        break;
      case "filesystem:write":
        result = this.authorizePath(
          operation.path,
          this.permissions?.filesystem?.writePaths,
          "write",
        );
        break;
      case "network:connect":
        result = this.authorizeNetwork(operation.host);
        break;
      case "shell:execute":
        result = this.authorizeShell();
        break;
      case "environment:read":
        result = this.authorizeEnv(operation.varName);
        break;
      case "credentials:read":
        result = this.authorizeCredentials(operation.key);
        break;
      case "runtime:spawnProcess":
        result = {
          allowed: false,
          reason: "Runtime process spawning by plugins is denied by default.",
        };
        break;
      case "persistence:write":
        result = this.authorizePersistence();
        break;
      default:
        result = {
          allowed: false,
          reason: "Unknown operation kind denied by default policy.",
        };
    }

    this.auditLogs.push({
      timestamp: new Date().toISOString(),
      operation: redactOperation(operation),
      allowed: result.allowed,
      reason: redactSensitiveText(result.reason),
    });

    return result;
  }

  private authorizePath(
    targetPath: string,
    allowedPatterns: readonly string[] | undefined,
    action: "read" | "write",
  ): { allowed: boolean; reason: string } {
    if (!targetPath || typeof targetPath !== "string") {
      return { allowed: false, reason: `Invalid ${action} path provided.` };
    }

    // Path traversal / confused-deputy protection
    if (targetPath.includes("\0")) {
      return {
        allowed: false,
        reason: `Path contains null bytes: '${targetPath}'.`,
      };
    }
    if (targetPath.includes("..")) {
      return {
        allowed: false,
        reason: `Path traversal '..' is strictly forbidden: '${targetPath}'.`,
      };
    }

    const resolved = isAbsolute(targetPath)
      ? normalize(targetPath)
      : resolve(this.workspaceRoot, targetPath);

    if (!resolved.startsWith(this.workspaceRoot)) {
      return {
        allowed: false,
        reason: `Path '${targetPath}' resolves outside workspace root directory.`,
      };
    }

    if (!allowedPatterns || allowedPatterns.length === 0) {
      return {
        allowed: false,
        reason: `Plugin has no allowed filesystem ${action} paths configured (deny by default).`,
      };
    }

    const relPath = normalize(resolved.substring(this.workspaceRoot.length))
      .replaceAll("\\", "/")
      .replace(/^\/+/, "");
    const match = allowedPatterns.some((pattern) => {
      const normPattern = normalize(pattern)
        .replaceAll("\\", "/")
        .replace(/^\/+/, "");
      return relPath === normPattern || relPath.startsWith(normPattern + "/");
    });

    if (!match) {
      return {
        allowed: false,
        reason: `Path '${relPath}' is not in configured allowed ${action} paths: [${allowedPatterns.join(", ")}].`,
      };
    }

    return {
      allowed: true,
      reason: `Access granted for ${action} on path '${relPath}'.`,
    };
  }

  private authorizeNetwork(host: string): { allowed: boolean; reason: string } {
    if (!host) return { allowed: false, reason: "Invalid network host." };
    const allowedHosts = this.permissions?.network?.allowedHosts;
    if (!allowedHosts || allowedHosts.length === 0) {
      return {
        allowed: false,
        reason:
          "Network access is denied by default (no allowed hosts configured).",
      };
    }

    if (allowedHosts.includes(host) || allowedHosts.includes("*")) {
      return {
        allowed: true,
        reason: `Network connection to '${host}' granted.`,
      };
    }

    return {
      allowed: false,
      reason: `Network host '${host}' is not in configured allowedHosts: [${allowedHosts.join(", ")}].`,
    };
  }

  private authorizeShell(): { allowed: boolean; reason: string } {
    if (this.permissions?.shell === true) {
      return {
        allowed: true,
        reason: "Shell execution granted by explicit plugin permissions.",
      };
    }
    return { allowed: false, reason: "Shell execution is denied by default." };
  }

  private authorizeEnv(varName: string): { allowed: boolean; reason: string } {
    const allowedVars = this.permissions?.environment?.allowedVars;
    if (!allowedVars || allowedVars.length === 0) {
      return {
        allowed: false,
        reason: "Environment variable access denied by default.",
      };
    }

    if (allowedVars.includes(varName) || allowedVars.includes("*")) {
      return {
        allowed: true,
        reason: `Environment variable '${varName}' access granted.`,
      };
    }

    return {
      allowed: false,
      reason: `Environment variable '${varName}' is not in configured allowed envVars.`,
    };
  }

  private authorizeCredentials(key: string): {
    allowed: boolean;
    reason: string;
  } {
    const allowedKeys = this.permissions?.credentials?.allowedKeys;
    if (!allowedKeys || allowedKeys.length === 0) {
      return { allowed: false, reason: "Credential access denied by default." };
    }

    if (allowedKeys.includes(key)) {
      return { allowed: true, reason: `Credential '${key}' access granted.` };
    }

    return {
      allowed: false,
      reason: `Credential key '${key}' is not in configured allowed credentials.`,
    };
  }

  private authorizePersistence(): { allowed: boolean; reason: string } {
    if (this.permissions?.persistence === true) {
      return {
        allowed: true,
        reason: "Persistence mutation granted by explicit plugin permissions.",
      };
    }
    return {
      allowed: false,
      reason: "Persistence mutation is denied by default.",
    };
  }
}

function redactOperation(operation: PermissionOperation): PermissionOperation {
  switch (operation.kind) {
    case "filesystem:read":
    case "filesystem:write":
      return { ...operation, path: redactSensitiveText(operation.path, 512) };
    case "network:connect":
      return { ...operation, host: redactSensitiveText(operation.host, 256) };
    case "shell:execute":
      return {
        ...operation,
        command: redactSensitiveText(operation.command, 512),
      };
    case "environment:read":
      return {
        ...operation,
        varName: redactSensitiveText(operation.varName, 128),
      };
    case "credentials:read":
      return { ...operation, key: redactSensitiveText(operation.key, 128) };
    case "persistence:write":
      return { ...operation, key: redactSensitiveText(operation.key, 256) };
    case "runtime:spawnProcess":
      return operation;
  }
}
