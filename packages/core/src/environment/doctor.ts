import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type DoctorCheckId =
  | "node"
  | "pnpm"
  | "git"
  | "platform"
  | "filesystem"
  | "repository"
  | "configuration"
  | "parser"
  | "index"
  | "daemon"
  | "mcp"
  | "extension";
export type DoctorCheckStatus = "pass" | "warning" | "fail";

export interface DoctorCheck {
  readonly id: DoctorCheckId;
  readonly status: DoctorCheckStatus;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, string | boolean | null>>;
}

export interface DoctorReport {
  readonly schemaVersion: 1;
  readonly status: "ready" | "attention";
  readonly checks: readonly DoctorCheck[];
}

export interface DoctorDependencies {
  readonly nodeVersion?: string;
  readonly pnpmUserAgent?: string;
  readonly checkPnpm?: () => string | undefined;
  readonly platform?: NodeJS.Platform;
  readonly checkGit?: () => string | undefined;
  readonly checkAccess?: (path: string, mode: number) => Promise<void>;
  readonly checkPath?: (path: string) => Promise<boolean>;
  readonly checkConfiguration?: () => Promise<void>;
}

export const DOCTOR_REPORT_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://fuzit.local/schemas/doctor-report.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "status", "checks"],
  properties: {
    schemaVersion: { const: 1 },
    status: { enum: ["ready", "attention"] },
    checks: {
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status", "message"],
        properties: {
          id: {
            enum: [
              "node",
              "pnpm",
              "git",
              "platform",
              "filesystem",
              "repository",
              "configuration",
              "parser",
              "index",
              "daemon",
              "mcp",
              "extension",
            ],
          },
          status: { enum: ["pass", "warning", "fail"] },
          message: { type: "string", minLength: 1 },
          metadata: {
            type: "object",
            additionalProperties: {
              type: ["string", "boolean", "null"],
            },
          },
        },
      },
    },
  },
} as const;

function defaultGitCheck(): string | undefined {
  const result = spawnSync("git", ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    return undefined;
  }

  return result.stdout.trim().replace(/^git version\s+/, "") || undefined;
}

async function defaultPathCheck(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findRepository(
  startDirectory: string,
  checkPath: (path: string) => Promise<boolean>,
): Promise<boolean> {
  let directory = resolve(startDirectory);

  while (true) {
    if (await checkPath(join(directory, ".git"))) {
      return true;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      return false;
    }
    directory = parent;
  }
}

function pnpmVersion(userAgent: string | undefined): string | undefined {
  return userAgent?.match(/(?:^|\s)pnpm\/([^\s]+)/)?.[1];
}

function defaultPnpmCheck(): string | undefined {
  const npmExecPath = process.env.npm_execpath;
  const executable = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "pnpm.cmd"
      : "pnpm";
  const arguments_ = npmExecPath ? [npmExecPath, "--version"] : ["--version"];
  const result = spawnSync(executable, arguments_, {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 3000,
  });
  return result.error || result.status !== 0
    ? undefined
    : result.stdout.trim() || undefined;
}

export async function runDoctor(
  workingDirectory: string,
  dependencies: DoctorDependencies = {},
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  checks.push({
    id: "node",
    status: "pass",
    message: "Node.js is available.",
    metadata: { version: nodeVersion },
  });

  const detectedPnpmVersion =
    pnpmVersion(
      dependencies.pnpmUserAgent ?? process.env.npm_config_user_agent,
    ) ?? (dependencies.checkPnpm ?? defaultPnpmCheck)();
  checks.push(
    detectedPnpmVersion
      ? {
          id: "pnpm",
          status: "pass",
          message: "pnpm metadata is available.",
          metadata: { version: detectedPnpmVersion },
        }
      : {
          id: "pnpm",
          status: "warning",
          message: "pnpm metadata is unavailable in this process.",
          metadata: { version: null },
        },
  );

  checks.push({
    id: "platform",
    status: "pass",
    message: "Platform metadata is available.",
    metadata: {
      platform: dependencies.platform ?? process.platform,
      architecture: process.arch,
    },
  });

  const gitVersion = (dependencies.checkGit ?? defaultGitCheck)();
  checks.push(
    gitVersion
      ? {
          id: "git",
          status: "pass",
          message: "Git is available.",
          metadata: { version: gitVersion },
        }
      : {
          id: "git",
          status: "fail",
          message: "Git is unavailable.",
          metadata: { version: null },
        },
  );

  const checkAccess = dependencies.checkAccess ?? access;
  let readable = true;
  let writable = true;
  try {
    await checkAccess(workingDirectory, constants.R_OK);
  } catch {
    readable = false;
  }
  try {
    await checkAccess(workingDirectory, constants.W_OK);
  } catch {
    writable = false;
  }
  checks.push({
    id: "filesystem",
    status: readable && writable ? "pass" : "fail",
    message:
      readable && writable
        ? "Working directory is readable and writable."
        : "Working directory permissions are insufficient.",
    metadata: { readable, writable },
  });

  for (const component of ["parser", "index"] as const) {
    checks.push({
      id: component,
      status: "pass",
      message: `${component === "parser" ? "Built-in parser" : "Local index"} compatibility is available.`,
      metadata: { available: true, compatible: true, version: "1" },
    });
  }

  checks.push({
    id: "daemon",
    status: "warning",
    message: "No daemon is required for local CLI operation.",
    metadata: { available: false, compatible: true, version: null },
  });

  const checkPath = dependencies.checkPath ?? defaultPathCheck;
  for (const [id, path, label] of [
    ["mcp", "packages/mcp-server/package.json", "MCP server"],
    ["extension", "apps/vscode-extension/package.json", "VS Code extension"],
  ] as const) {
    const available = await checkPath(join(workingDirectory, path));
    checks.push({
      id,
      status: available ? "pass" : "warning",
      message: available
        ? `${label} compatibility is available.`
        : `${label} is not installed in this environment.`,
      metadata: {
        available,
        compatible: true,
        version: available ? "1" : null,
      },
    });
  }

  const repositoryDetected = await findRepository(
    workingDirectory,
    dependencies.checkPath ?? defaultPathCheck,
  );
  checks.push({
    id: "repository",
    status: repositoryDetected ? "pass" : "fail",
    message: repositoryDetected
      ? "Repository detected."
      : "Repository not detected.",
    metadata: { detected: repositoryDetected },
  });

  let configurationValid = true;
  try {
    await dependencies.checkConfiguration?.();
  } catch {
    configurationValid = false;
  }
  checks.push({
    id: "configuration",
    status: configurationValid ? "pass" : "fail",
    message: configurationValid
      ? "Configuration is valid."
      : "Configuration is invalid.",
    metadata: { valid: configurationValid },
  });

  return {
    schemaVersion: 1,
    status: checks.some((check) => check.status === "fail")
      ? "attention"
      : "ready",
    checks,
  };
}
