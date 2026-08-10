export type WatchState = "idle" | "running" | "stopping";

export interface WatchController {
  readonly root: string;
  readonly state: WatchState;
  stop(): void;
}

export interface WatchRegistryEntry {
  controller: AbortController;
  state: WatchState;
}

/**
 * Manages watch controller instances per workspace root.
 * Enforces one-watcher-per-root and prevents duplicate watchers.
 */
export class WatchRegistry {
  private readonly entries = new Map<string, WatchRegistryEntry>();

  isWatching(root: string): boolean {
    const entry = this.entries.get(root);
    return entry?.state === "running";
  }

  start(root: string): AbortController {
    if (this.isWatching(root)) {
      throw new Error(`A watcher is already running for root: ${root}`);
    }
    const controller = new AbortController();
    this.entries.set(root, { controller, state: "running" });
    return controller;
  }

  stop(root: string): void {
    const entry = this.entries.get(root);
    if (!entry || entry.state !== "running") return;
    entry.state = "stopping";
    entry.controller.abort(new Error("watch stopped"));
    this.entries.delete(root);
  }

  stopAll(): void {
    for (const root of this.entries.keys()) {
      this.stop(root);
    }
  }

  getState(root: string): WatchState {
    return this.entries.get(root)?.state ?? "idle";
  }
}

/**
 * Start watching a workspace root. Enforces one watcher per root.
 */
export async function startWatchCommand(
  registry: WatchRegistry,
  root: string,
  isTrusted: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!isTrusted) {
    return {
      ok: false,
      message: "Workspace Trust is required to start watch.",
    };
  }
  if (!root || root.trim().length === 0) {
    return { ok: false, message: "No workspace root selected." };
  }
  if (registry.isWatching(root)) {
    return {
      ok: false,
      message: `A watcher is already active for this root.`,
    };
  }
  registry.start(root);
  return { ok: true };
}

/**
 * Stop watching a workspace root.
 */
export function stopWatchCommand(
  registry: WatchRegistry,
  root: string,
): { ok: boolean; message?: string } {
  if (!registry.isWatching(root)) {
    return { ok: false, message: "No active watcher for this root." };
  }
  registry.stop(root);
  return { ok: true };
}
