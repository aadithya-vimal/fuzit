import { describe, expect, it } from "vitest";
import { EventCoalescer } from "@fuzit/watcher";

describe("event coalescing", () => {
  it("coalesces rapid burst of modifications on the same file into a single modify event", () => {
    const coalescer = new EventCoalescer();
    const now = Date.now();

    coalescer.push({
      contractVersion: 1,
      kind: "modify",
      path: "src/file.ts",
      timestampMs: now,
    });
    coalescer.push({
      contractVersion: 1,
      kind: "modify",
      path: "src/file.ts",
      timestampMs: now + 10,
    });
    coalescer.push({
      contractVersion: 1,
      kind: "modify",
      path: "src/file.ts",
      timestampMs: now + 20,
    });

    const batch = coalescer.flush("batch-1");
    expect(batch.events.length).toBe(1);
    expect(batch.events[0]).toEqual({
      contractVersion: 1,
      kind: "modify",
      path: "src/file.ts",
      timestampMs: now + 20,
    });
    expect(batch.overflowOccurred).toBe(false);
  });

  it("coalesces add followed by delete into no event", () => {
    const coalescer = new EventCoalescer();
    const now = Date.now();

    coalescer.push({
      contractVersion: 1,
      kind: "add",
      path: "src/temp.ts",
      timestampMs: now,
    });
    coalescer.push({
      contractVersion: 1,
      kind: "delete",
      path: "src/temp.ts",
      timestampMs: now + 10,
    });

    const batch = coalescer.flush("batch-2");
    expect(batch.events.length).toBe(0);
  });

  it("handles event overflow exceeding maxBatchSize", () => {
    const coalescer = new EventCoalescer({ maxBatchSize: 2 });
    const now = Date.now();

    coalescer.push({
      contractVersion: 1,
      kind: "add",
      path: "src/1.ts",
      timestampMs: now,
    });
    coalescer.push({
      contractVersion: 1,
      kind: "add",
      path: "src/2.ts",
      timestampMs: now,
    });
    coalescer.push({
      contractVersion: 1,
      kind: "add",
      path: "src/3.ts",
      timestampMs: now,
    });

    const batch = coalescer.flush("batch-3");
    expect(batch.events.length).toBe(2);
    expect(batch.overflowOccurred).toBe(true);
    expect(batch.reconciliationRequired).toBe(true);
  });
});
