import { describe, expect, it } from "vitest";
import {
  validateWatcherEvent,
  watcherBatchSchema,
  watcherStatusSchema,
  type WatcherEvent,
} from "@fuzit/schemas";

describe("watcher contract validation", () => {
  it("validates safe relative watcher event", () => {
    const event: WatcherEvent = {
      contractVersion: 1,
      kind: "modify",
      path: "src/index.ts",
      timestampMs: 1700000000000,
    };
    expect(validateWatcherEvent(event)).toEqual(event);
  });

  it("validates rename watcher event", () => {
    const event: WatcherEvent = {
      contractVersion: 1,
      kind: "rename",
      path: "src/old.ts",
      renamedTo: "src/new.ts",
      timestampMs: 1700000000000,
    };
    expect(validateWatcherEvent(event)).toEqual(event);
  });

  it("rejects absolute and path traversal watcher event paths", () => {
    expect(() =>
      validateWatcherEvent({
        contractVersion: 1,
        kind: "modify",
        path: "/etc/passwd",
        timestampMs: 1700000000000,
      }),
    ).toThrow("path traversal");

    expect(() =>
      validateWatcherEvent({
        contractVersion: 1,
        kind: "modify",
        path: "../outside.ts",
        timestampMs: 1700000000000,
      }),
    ).toThrow("path traversal");
  });

  it("validates watcher batch structure", () => {
    const batch = watcherBatchSchema.parse({
      contractVersion: 1,
      batchId: "batch-1",
      events: [
        {
          contractVersion: 1,
          kind: "add",
          path: "src/a.ts",
          timestampMs: 1700000000000,
        },
      ],
      reconciliationRequired: false,
      overflowOccurred: false,
    });
    expect(batch.batchId).toBe("batch-1");
  });

  it("validates watcher status structure", () => {
    const status = watcherStatusSchema.parse({
      contractVersion: 1,
      state: "watching",
      repositoryRoot: "/repo",
      lockOwner: "fuzit-watcher-daemon",
      activeWatchers: 1,
      eventsProcessed: 42,
      lastEventTimestampMs: 1700000000000,
    });
    expect(status.state).toBe("watching");
  });
});
