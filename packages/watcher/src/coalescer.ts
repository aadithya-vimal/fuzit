import {
  WATCHER_CONTRACT_VERSION,
  type WatcherBatch,
  type WatcherEvent,
} from "@fuzit/schemas";

export interface CoalescerOptions {
  readonly debounceMs?: number | undefined; // default 100ms
  readonly maxBatchSize?: number | undefined; // default 500
}

export class EventCoalescer {
  private readonly debounceMs: number;
  private readonly maxBatchSize: number;
  private pendingEvents: WatcherEvent[] = [];

  constructor(options: CoalescerOptions = {}) {
    this.debounceMs = options.debounceMs ?? 100;
    this.maxBatchSize = options.maxBatchSize ?? 500;
  }

  public push(event: WatcherEvent): void {
    this.pendingEvents.push(event);
  }

  public pushAll(events: readonly WatcherEvent[]): void {
    for (const e of events) {
      this.pendingEvents.push(e);
    }
  }

  public flush(batchId: string): WatcherBatch {
    const eventsToProcess = [...this.pendingEvents];
    this.pendingEvents = [];

    const overflowOccurred = eventsToProcess.length > this.maxBatchSize;
    const boundedEvents = eventsToProcess.slice(0, this.maxBatchSize);

    const isAtomicSaveTemp = (p: string) =>
      p.endsWith(".tmp") ||
      p.endsWith(".bak") ||
      p.endsWith("~") ||
      p.includes(".goutputstream-");

    const atomicSaveTargets = new Map<string, WatcherEvent>();
    for (const e of boundedEvents) {
      if (e.renamedTo && !isAtomicSaveTemp(e.renamedTo)) {
        atomicSaveTargets.set(e.renamedTo, {
          contractVersion: WATCHER_CONTRACT_VERSION,
          kind: "modify",
          path: e.renamedTo,
          timestampMs: e.timestampMs,
        });
      }
    }

    const map = new Map<string, WatcherEvent>();

    for (const event of boundedEvents) {
      if (isAtomicSaveTemp(event.path)) {
        if (event.renamedTo && atomicSaveTargets.has(event.renamedTo)) {
          const targetEvent = atomicSaveTargets.get(event.renamedTo)!;
          map.set(event.renamedTo, targetEvent);
        }
        continue;
      }

      const existing = map.get(event.path);
      if (!existing) {
        map.set(event.path, event);
        continue;
      }

      if (existing.kind === "add" && event.kind === "delete") {
        map.delete(event.path);
      } else if (existing.kind === "add" && event.kind === "modify") {
        map.set(event.path, { ...existing, timestampMs: event.timestampMs });
      } else if (existing.kind === "modify" && event.kind === "modify") {
        map.set(event.path, { ...existing, timestampMs: event.timestampMs });
      } else if (existing.kind === "modify" && event.kind === "delete") {
        map.set(event.path, event);
      } else {
        map.set(event.path, event);
      }
    }

    const coalescedEvents = Array.from(map.values()).sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    return {
      contractVersion: WATCHER_CONTRACT_VERSION,
      batchId,
      events: coalescedEvents,
      reconciliationRequired: overflowOccurred,
      overflowOccurred,
    };
  }
}
