import { NativeFilesystemAdapter } from "./adapter.js";
import { EventCoalescer } from "./coalescer.js";
import { IndexWriterLock } from "./lock.js";
import { reconcileRepositoryState } from "./reconciler.js";
import { applyEventsToLocalIndex } from "./applier.js";
import type { LocalIndexSemanticState } from "@fuzit/index";
import type { WatcherStatus } from "@fuzit/schemas";

export interface WatcherDaemonOptions {
  readonly repositoryRoot: string;
  readonly indexPath: string;
  readonly repositoryId: string;
  readonly semanticState: LocalIndexSemanticState;
  readonly ignorePatterns?: readonly string[] | undefined;
  readonly debounceMs?: number | undefined;
}

export class WatcherDaemon {
  private readonly options: WatcherDaemonOptions;
  private readonly adapter: NativeFilesystemAdapter;
  private readonly coalescer: EventCoalescer;
  private readonly lock: IndexWriterLock;
  private running = false;
  private currentStatus:
    "stopped" | "starting" | "watching" | "reconciling" | "stopping" | "error" =
    "stopped";
  private eventsProcessedCount = 0;
  private lastEventTs: number | null = null;
  private abortController?: AbortController | undefined;

  constructor(options: WatcherDaemonOptions) {
    this.options = options;
    this.coalescer = new EventCoalescer({ debounceMs: options.debounceMs });
    this.lock = new IndexWriterLock({
      indexPath: options.indexPath,
      repositoryId: options.repositoryId,
    });
    this.adapter = new NativeFilesystemAdapter({
      repositoryRoot: options.repositoryRoot,
      ignorePatterns: options.ignorePatterns,
      onEvent: (event) => {
        if (this.running) {
          this.coalescer.push(event);
          this.eventsProcessedCount++;
          this.lastEventTs = event.timestampMs;
        }
      },
    });
  }

  public get status(): WatcherStatus {
    return {
      contractVersion: 1,
      state: this.currentStatus,
      repositoryRoot: this.options.repositoryRoot,
      lockOwner:
        this.lock.isHeld && this.lock.metadata
          ? `pid:${this.lock.metadata.pid}`
          : null,
      activeWatchers: this.running ? 1 : 0,
      eventsProcessed: this.eventsProcessedCount,
      lastEventTimestampMs: this.lastEventTs,
    };
  }

  public async start(): Promise<void> {
    if (this.running) return;

    this.currentStatus = "starting";
    await this.lock.acquire();

    this.running = true;
    this.currentStatus = "watching";
    this.abortController = new AbortController();

    await this.adapter.start();
  }

  public async processPendingBatch(batchId: string): Promise<void> {
    if (!this.running) return;

    const batch = this.coalescer.flush(batchId);
    if (batch.events.length === 0 && !batch.reconciliationRequired) return;

    if (batch.reconciliationRequired) {
      this.currentStatus = "reconciling";
      await reconcileRepositoryState(batch, {
        indexPath: this.options.indexPath,
        repositoryId: this.options.repositoryId,
        repositoryRoot: this.options.repositoryRoot,
        ignorePatterns: this.options.ignorePatterns,
        semanticState: this.options.semanticState,
        signal: this.abortController?.signal,
      });
      this.currentStatus = "watching";
    } else {
      await applyEventsToLocalIndex(batch.events, {
        indexPath: this.options.indexPath,
        repositoryId: this.options.repositoryId,
        repositoryRoot: this.options.repositoryRoot,
        ignorePatterns: this.options.ignorePatterns,
        semanticState: this.options.semanticState,
      });
    }
  }

  public async stop(): Promise<void> {
    if (!this.running) {
      await this.lock.release();
      this.currentStatus = "stopped";
      return;
    }

    this.currentStatus = "stopping";
    this.running = false;

    this.abortController?.abort();

    try {
      await this.adapter.stop();
    } finally {
      await this.lock.release();
      this.currentStatus = "stopped";
    }
  }
}
