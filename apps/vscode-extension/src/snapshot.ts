import { executeEngineCommand } from "./adapter.js";
import type { EngineAdapterOptions } from "./adapter.js";

export interface SnapshotCommandContext {
  readonly isTrusted: boolean;
  readonly workspaceRoot: string;
  readonly cliPath?: string;
}

export interface SnapshotCommandResponse {
  readonly ok: boolean;
  readonly message?: string;
  readonly data?: unknown;
}

function ensureTrusted(
  context: SnapshotCommandContext,
  label: string,
): SnapshotCommandResponse | null {
  if (!context.isTrusted) {
    return {
      ok: false,
      message: `Workspace Trust is required to ${label}.`,
    };
  }
  if (!context.workspaceRoot || context.workspaceRoot.trim().length === 0) {
    return { ok: false, message: "No workspace root selected." };
  }
  return null;
}

function adapterOpts(ctx: SnapshotCommandContext): EngineAdapterOptions {
  return {
    cwd: ctx.workspaceRoot,
    ...(ctx.cliPath !== undefined ? { cliPath: ctx.cliPath } : {}),
  };
}

/**
 * Create a new repository snapshot through the engine adapter.
 */
export async function createSnapshotCommand(
  context: SnapshotCommandContext,
): Promise<SnapshotCommandResponse> {
  const guard = ensureTrusted(context, "create snapshot");
  if (guard) return guard;

  try {
    const result = await executeEngineCommand(
      ["snapshot", "create", "--json"],
      adapterOpts(context),
    );
    if (result.exitCode !== 0) {
      return {
        ok: false,
        message: result.stderr || "Snapshot creation failed",
      };
    }
    return { ok: true, data: JSON.parse(result.stdout || "{}") };
  } catch (error: unknown) {
    return {
      ok: false,
      message: (error as Error).message || "Snapshot creation failed",
    };
  }
}

/**
 * Compare two snapshots through the engine adapter.
 */
export async function diffSnapshotCommand(
  context: SnapshotCommandContext,
  snapshotIdA: string,
  snapshotIdB: string,
): Promise<SnapshotCommandResponse> {
  const guard = ensureTrusted(context, "compare snapshots");
  if (guard) return guard;

  if (!snapshotIdA || !snapshotIdB) {
    return { ok: false, message: "Two snapshot IDs are required for diff." };
  }

  try {
    const result = await executeEngineCommand(
      ["snapshot", "diff", "--json", snapshotIdA, snapshotIdB],
      adapterOpts(context),
    );
    if (result.exitCode !== 0) {
      return { ok: false, message: result.stderr || "Snapshot diff failed" };
    }
    return { ok: true, data: JSON.parse(result.stdout || "{}") };
  } catch (error: unknown) {
    return {
      ok: false,
      message: (error as Error).message || "Snapshot diff failed",
    };
  }
}

/**
 * Get graph neighbors for a given file path through the engine adapter.
 */
export async function graphNeighborsCommand(
  context: SnapshotCommandContext,
  filePath: string,
): Promise<SnapshotCommandResponse> {
  const guard = ensureTrusted(context, "get graph neighbors");
  if (guard) return guard;

  if (!filePath || filePath.trim().length === 0) {
    return {
      ok: false,
      message: "A file path is required for graph neighbors.",
    };
  }

  try {
    const result = await executeEngineCommand(
      ["graph", "neighbors", "--json", filePath],
      adapterOpts(context),
    );
    if (result.exitCode !== 0) {
      return { ok: false, message: result.stderr || "Graph neighbors failed" };
    }
    return { ok: true, data: JSON.parse(result.stdout || "{}") };
  } catch (error: unknown) {
    return {
      ok: false,
      message: (error as Error).message || "Graph neighbors failed",
    };
  }
}

/**
 * Get cache status through the engine adapter.
 */
export async function cacheStatusCommand(
  context: SnapshotCommandContext,
): Promise<SnapshotCommandResponse> {
  const guard = ensureTrusted(context, "check cache status");
  if (guard) return guard;

  try {
    const result = await executeEngineCommand(
      ["cache", "status", "--json"],
      adapterOpts(context),
    );
    if (result.exitCode !== 0) {
      return {
        ok: false,
        message: result.stderr || "Cache status check failed",
      };
    }
    return { ok: true, data: JSON.parse(result.stdout || "{}") };
  } catch (error: unknown) {
    return {
      ok: false,
      message: (error as Error).message || "Cache status check failed",
    };
  }
}
