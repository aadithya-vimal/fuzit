import { isAbsolute, normalize, relative } from "node:path";
import {
  validateWatcherEvent,
  WATCHER_CONTRACT_VERSION,
  type WatcherEvent,
} from "@fuzit/schemas";

export interface FilesystemAdapterOptions {
  readonly repositoryRoot: string;
  readonly ignorePatterns?: readonly string[] | undefined;
  readonly onEvent?: ((event: WatcherEvent) => void) | undefined;
  readonly onError?: ((error: Error) => void) | undefined;
}

export interface FilesystemAdapter {
  readonly repositoryRoot: string;
  readonly isWatching: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  emitSyntheticEvent(
    rawKind: string,
    rawPath: string,
    renamedTo?: string,
  ): WatcherEvent;
}

export class NativeFilesystemAdapter implements FilesystemAdapter {
  public readonly repositoryRoot: string;
  private readonly ignorePatterns: readonly string[];
  private readonly onEvent?: ((event: WatcherEvent) => void) | undefined;
  private readonly onError?: ((error: Error) => void) | undefined;
  private watching = false;

  constructor(options: FilesystemAdapterOptions) {
    if (!isAbsolute(options.repositoryRoot)) {
      throw new Error("Repository root must be an absolute path.");
    }
    this.repositoryRoot = normalize(options.repositoryRoot);
    this.ignorePatterns = options.ignorePatterns ?? [];
    this.onEvent = options.onEvent;
    this.onError = options.onError;
  }

  public get isWatching(): boolean {
    return this.watching;
  }

  public async start(): Promise<void> {
    this.watching = true;
  }

  public async stop(): Promise<void> {
    this.watching = false;
  }

  public emitSyntheticEvent(
    rawKind: string,
    rawPath: string,
    renamedTo?: string,
  ): WatcherEvent {
    if (!this.watching) {
      throw new Error("Cannot emit event while adapter is stopped.");
    }

    let relPath: string;
    if (isAbsolute(rawPath)) {
      const normalizedRaw = normalize(rawPath);
      if (!normalizedRaw.startsWith(this.repositoryRoot)) {
        throw new Error(
          "Path escape detected: path is outside repository root.",
        );
      }
      relPath = relative(this.repositoryRoot, normalizedRaw).replace(
        /\\/g,
        "/",
      );
    } else {
      relPath = rawPath.replace(/\\/g, "/");
    }

    let relRenamedTo: string | undefined;
    if (renamedTo) {
      if (isAbsolute(renamedTo)) {
        const normalizedRenamed = normalize(renamedTo);
        if (!normalizedRenamed.startsWith(this.repositoryRoot)) {
          throw new Error(
            "Path escape detected: renamedTo path is outside repository root.",
          );
        }
        relRenamedTo = relative(this.repositoryRoot, normalizedRenamed).replace(
          /\\/g,
          "/",
        );
      } else {
        relRenamedTo = renamedTo.replace(/\\/g, "/");
      }
    }

    for (const pattern of this.ignorePatterns) {
      if (relPath.startsWith(pattern) || relPath.includes(`/${pattern}`)) {
        throw new Error(`Ignored path change rejected: ${relPath}`);
      }
    }

    const event: WatcherEvent = validateWatcherEvent({
      contractVersion: WATCHER_CONTRACT_VERSION,
      kind: rawKind as WatcherEvent["kind"],
      path: relPath,
      ...(relRenamedTo ? { renamedTo: relRenamedTo } : {}),
      timestampMs: Date.now(),
    });

    this.onEvent?.(event);
    return event;
  }
}
