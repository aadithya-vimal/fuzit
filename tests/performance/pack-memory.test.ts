import { describe, expect, it } from "vitest";

import { estimateBudget } from "@fuzit/budgeting";

describe("large repository budget memory", () => {
  it("keeps a 10 MiB synthetic input under a bounded heap threshold", () => {
    const before = process.memoryUsage().heapUsed;
    const content = "x".repeat(10 * 1024 * 1024);
    expect(estimateBudget(content).bytes).toBe(10 * 1024 * 1024);
    const growth = process.memoryUsage().heapUsed - before;
    expect(growth).toBeLessThan(32 * 1024 * 1024);
  });
});
