import { runDoctor } from "@fuzit/core";
import { executeEngineCommand } from "./adapter.js";
import type { EngineAdapterOptions } from "./adapter.js";

function makeOpts(context: CommandContext): EngineAdapterOptions {
  return {
    cwd: context.workspaceRoot,
    ...(context.cliPath !== undefined ? { cliPath: context.cliPath } : {}),
  };
}

export interface CommandContext {
  readonly isTrusted: boolean;
  readonly workspaceRoot: string;
  readonly cliPath?: string;
}

export interface CommandResponse {
  readonly ok: boolean;
  readonly message?: string;
  readonly data?: unknown;
}

/**
 * Executes the `fuzit.init` command.
 * Respects Workspace Trust and prevents overwriting existing configuration silently.
 */
export async function initializeWorkspaceCommand(
  context: CommandContext,
): Promise<CommandResponse> {
  if (!context.isTrusted) {
    return {
      ok: false,
      message: "Workspace Trust is required to initialize Fuzit workspace.",
    };
  }

  if (!context.workspaceRoot || context.workspaceRoot.trim().length === 0) {
    return {
      ok: false,
      message: "No workspace root selected.",
    };
  }

  try {
    const result = await executeEngineCommand(["init"], makeOpts(context));

    if (result.exitCode !== 0) {
      return {
        ok: false,
        message: result.stderr || "Initialization failed",
      };
    }

    return {
      ok: true,
      message: "Workspace initialized successfully.",
      data: { root: context.workspaceRoot },
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      ok: false,
      message: err.message || "Failed to initialize workspace",
    };
  }
}

/**
 * Executes the `fuzit.doctor` command.
 * Respects Workspace Trust and returns path-redacted doctor diagnostic report.
 */
export async function runDoctorCommand(
  context: CommandContext,
): Promise<CommandResponse> {
  if (!context.isTrusted) {
    return {
      ok: false,
      message: "Workspace Trust is required to run Fuzit doctor checks.",
    };
  }

  if (!context.workspaceRoot || context.workspaceRoot.trim().length === 0) {
    return {
      ok: false,
      message: "No workspace root selected.",
    };
  }

  try {
    const report = await runDoctor(context.workspaceRoot);
    const redactedChecks = report.checks.map((check) => ({
      ...check,
      metadata: check.metadata
        ? Object.fromEntries(
            Object.entries(check.metadata).map(([k, v]) => [
              k,
              typeof v === "string" && v.includes(context.workspaceRoot)
                ? v.replaceAll(context.workspaceRoot, "<root>")
                : v,
            ]),
          )
        : undefined,
    }));

    return {
      ok: true,
      data: { ...report, checks: redactedChecks },
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      ok: false,
      message: err.message || "Doctor check failed",
    };
  }
}

export interface GetContextOptions {
  readonly task: string;
  readonly profile?: string;
  readonly budgetTokens?: number;
  readonly format?: string;
}

/**
 * Executes the `fuzit.scan` command.
 * Respects Workspace Trust and returns scan metadata.
 */
export async function scanCommand(
  context: CommandContext,
): Promise<CommandResponse> {
  if (!context.isTrusted) {
    return {
      ok: false,
      message: "Workspace Trust is required to scan repository.",
    };
  }

  if (!context.workspaceRoot || context.workspaceRoot.trim().length === 0) {
    return {
      ok: false,
      message: "No workspace root selected.",
    };
  }

  try {
    const result = await executeEngineCommand(
      ["scan", "--json"],
      makeOpts(context),
    );

    if (result.exitCode !== 0) {
      return {
        ok: false,
        message: result.stderr || "Scan failed",
      };
    }

    return {
      ok: true,
      data: JSON.parse(result.stdout || "{}"),
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      ok: false,
      message: err.message || "Scan failed",
    };
  }
}

/**
 * Executes the `fuzit.getContext` command.
 * Respects Workspace Trust and builds task-aware context bundle with budget and profile controls.
 */
export async function getContextCommand(
  context: CommandContext,
  options: GetContextOptions,
): Promise<CommandResponse> {
  if (!context.isTrusted) {
    return {
      ok: false,
      message: "Workspace Trust is required to build task context.",
    };
  }

  if (!context.workspaceRoot || context.workspaceRoot.trim().length === 0) {
    return {
      ok: false,
      message: "No workspace root selected.",
    };
  }

  if (!options.task || options.task.trim().length === 0) {
    return {
      ok: false,
      message: "Task description must be a non-empty string.",
    };
  }

  const profile = options.profile ?? "feature-development";
  const budget = options.budgetTokens ?? 8000;
  const format = options.format ?? "markdown";

  try {
    const args = [
      "context",
      "--task",
      options.task,
      "--profile",
      profile,
      "--budget-tokens",
      String(budget),
      "--format",
      format,
    ];

    const result = await executeEngineCommand(args, makeOpts(context));

    if (result.exitCode !== 0) {
      return {
        ok: false,
        message: result.stderr || "Get context failed",
      };
    }

    return {
      ok: true,
      data: {
        root: context.workspaceRoot,
        task: options.task,
        profile,
        budget,
        format,
        content: result.stdout,
      },
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      ok: false,
      message: err.message || "Get context failed",
    };
  }
}
