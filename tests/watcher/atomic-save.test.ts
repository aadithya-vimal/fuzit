import { describe, expect, it } from "vitest";
import { EventCoalescer } from "@fuzit/watcher";
import type { WatcherEvent } from "@fuzit/schemas";

describe("editor atomic-save pattern handling", () => {
  it("recognizes VS Code / JetBrains atomic save (write temp, rename over target, delete temp) and emits single modify on target", () => {
    const coalescer = new EventCoalescer();
    const now = Date.now();

    // Burst representing VS Code / JetBrains atomic save to src/app.ts
    const events: WatcherEvent[] = [
      {
        contractVersion: 1,
        kind: "add",
        path: "src/app.ts.tmp",
        timestampMs: now,
      },
      {
        contractVersion: 1,
        kind: "modify",
        path: "src/app.ts.tmp",
        timestampMs: now + 5,
      },
      {
        contractVersion: 1,
        kind: "rename",
        path: "src/app.ts.tmp",
        renamedTo: "src/app.ts",
        timestampMs: Date.now() + 10,
      },
      {
        contractVersion: 1,
        kind: "delete",
        path: "src/app.ts.tmp",
        timestampMs: now + 15,
      },
    ];

    coalescer.pushAll(events);
    const batch = coalescer.flush("batch-atomic");

    expect(batch.events.length).toBe(1);
    expect(batch.events[0].path).toBe("src/app.ts");
    expect(batch.events[0].kind).toBe("modify");
  });
});
