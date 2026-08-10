export interface WorkspaceFolderLike {
  readonly name: string;
  readonly uri: {
    readonly fsPath: string;
  };
}

export interface QuickPickItemLike {
  readonly label: string;
  readonly description?: string | undefined;
  readonly detail?: string | undefined;
  readonly folder: WorkspaceFolderLike;
}

/**
 * Normalizes root paths for consistent per-root state keying across platforms.
 */
export function normalizeRootPath(path: string): string {
  if (!path) return "";
  let normalized = path.replace(/\\/g, "/").trim();
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.length > 0 && /^[a-zA-Z]:/.test(normalized)) {
    const driveLetter = normalized[0];
    if (driveLetter !== undefined) {
      normalized = driveLetter.toLowerCase() + normalized.slice(1);
    }
  }
  return normalized;
}

/**
 * Formats quick pick items for multi-root selection.
 * Explicitly disambiguates folders with the same basename by rendering their distinct parent paths.
 */
export function formatWorkspaceRootPicks(
  folders: readonly WorkspaceFolderLike[],
): QuickPickItemLike[] {
  const nameCounts = new Map<string, number>();
  for (const folder of folders) {
    const count = nameCounts.get(folder.name) ?? 0;
    nameCounts.set(folder.name, count + 1);
  }

  return folders.map((folder) => {
    const count = nameCounts.get(folder.name);
    const isDuplicateName = count !== undefined && count > 1;
    const normalized = normalizeRootPath(folder.uri.fsPath);

    return {
      label: folder.name,
      ...(isDuplicateName ? { description: normalized } : {}),
      detail: normalized,
      folder,
    };
  });
}

/**
 * Selects an explicit workspace root from multiple folders.
 * If preferredPath is provided, returns the matching folder.
 * If single folder, returns it.
 */
export function resolveWorkspaceRoot(
  folders: readonly WorkspaceFolderLike[],
  preferredPath?: string,
): WorkspaceFolderLike | null {
  if (folders.length === 0) return null;

  if (preferredPath) {
    const target = normalizeRootPath(preferredPath);
    const matched = folders.find(
      (f) => normalizeRootPath(f.uri.fsPath) === target,
    );
    if (matched) return matched;
  }

  if (folders.length === 1) {
    return folders[0] ?? null;
  }

  return null;
}

export interface PerRootState {
  readonly rootPath: string;
  readonly normalizedPath: string;
  readonly outputs: string[];
  readonly cache: Map<string, unknown>;
  readonly activeTasks: Set<string>;
}

/**
 * Manages isolated per-root state to prevent cross-root output or cache confusion.
 */
export class PerRootStateManager {
  private readonly states = new Map<string, PerRootState>();

  getOrCreateState(rootPath: string): PerRootState {
    const key = normalizeRootPath(rootPath);
    if (!key) {
      throw new Error("Workspace root path cannot be empty.");
    }
    let state = this.states.get(key);
    if (!state) {
      state = {
        rootPath,
        normalizedPath: key,
        outputs: [],
        cache: new Map<string, unknown>(),
        activeTasks: new Set<string>(),
      };
      this.states.set(key, state);
    }
    return state;
  }

  appendOutput(rootPath: string, message: string): void {
    const state = this.getOrCreateState(rootPath);
    state.outputs.push(message);
  }

  getOutputs(rootPath: string): readonly string[] {
    const key = normalizeRootPath(rootPath);
    return this.states.get(key)?.outputs ?? [];
  }

  setCache(rootPath: string, cacheKey: string, value: unknown): void {
    const state = this.getOrCreateState(rootPath);
    state.cache.set(cacheKey, value);
  }

  getCache(rootPath: string, cacheKey: string): unknown | undefined {
    const key = normalizeRootPath(rootPath);
    return this.states.get(key)?.cache.get(cacheKey);
  }

  clearCache(rootPath: string): void {
    const key = normalizeRootPath(rootPath);
    this.states.get(key)?.cache.clear();
  }

  clearAll(): void {
    this.states.clear();
  }
}

export interface ProgressReport {
  readonly message: string;
  readonly increment?: number;
}

export interface TaskExecutionResult<T = unknown> {
  readonly ok: boolean;
  readonly cancelled?: boolean;
  readonly data?: T;
  readonly message?: string;
}

/**
 * Manages cancellable tasks per workspace root.
 * Ensures cancellation stops owned work cleanly and leaves per-root state valid.
 */
export class CancellableTaskRunner {
  private readonly controllers = new Map<
    string,
    Map<string, AbortController>
  >();

  async runTask<T>(
    rootPath: string,
    taskId: string,
    operation: (
      signal: AbortSignal,
      reportProgress: (report: ProgressReport) => void,
    ) => Promise<T>,
    onProgress?: (report: ProgressReport) => void,
  ): Promise<TaskExecutionResult<T>> {
    const rootKey = normalizeRootPath(rootPath);
    if (!rootKey) {
      return { ok: false, message: "Workspace root path cannot be empty." };
    }

    let rootMap = this.controllers.get(rootKey);
    if (!rootMap) {
      rootMap = new Map<string, AbortController>();
      this.controllers.set(rootKey, rootMap);
    }

    if (rootMap.has(taskId)) {
      return {
        ok: false,
        message: `Task "${taskId}" is already running for root "${rootPath}".`,
      };
    }

    const controller = new AbortController();
    rootMap.set(taskId, controller);

    try {
      if (controller.signal.aborted) {
        return {
          ok: false,
          cancelled: true,
          message: `Task "${taskId}" was cancelled before starting.`,
        };
      }

      const resultData = await operation(controller.signal, (report) => {
        if (!controller.signal.aborted && onProgress) {
          onProgress(report);
        }
      });

      if (controller.signal.aborted) {
        return {
          ok: false,
          cancelled: true,
          message: `Task "${taskId}" was cancelled.`,
        };
      }

      return {
        ok: true,
        data: resultData,
      };
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return {
          ok: false,
          cancelled: true,
          message: `Task "${taskId}" was cancelled.`,
        };
      }
      return {
        ok: false,
        message: (error as Error).message || `Task "${taskId}" failed.`,
      };
    } finally {
      rootMap.delete(taskId);
      if (rootMap.size === 0) {
        this.controllers.delete(rootKey);
      }
    }
  }

  cancelTask(rootPath: string, taskId: string): boolean {
    const rootKey = normalizeRootPath(rootPath);
    const controller = this.controllers.get(rootKey)?.get(taskId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  cancelAllTasks(rootPath?: string): void {
    if (rootPath) {
      const rootKey = normalizeRootPath(rootPath);
      const rootMap = this.controllers.get(rootKey);
      if (rootMap) {
        for (const controller of rootMap.values()) {
          controller.abort();
        }
        rootMap.clear();
        this.controllers.delete(rootKey);
      }
    } else {
      for (const rootMap of this.controllers.values()) {
        for (const controller of rootMap.values()) {
          controller.abort();
        }
      }
      this.controllers.clear();
    }
  }

  isTaskRunning(rootPath: string, taskId: string): boolean {
    const rootKey = normalizeRootPath(rootPath);
    return this.controllers.get(rootKey)?.has(taskId) ?? false;
  }
}
