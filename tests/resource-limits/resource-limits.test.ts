import { describe, expect, it, vi } from "vitest";
import {
  ResourceLimitError,
  atomicWrite,
  enforceOutputLimit,
  mapConcurrent,
  operationSignal,
  withRollback,
} from "@fuzit/core";

describe("resource limits", () => {
  it("propagates Ctrl-C cancellation", () => {
    const input = new AbortController();
    const operation = operationSignal(input.signal, 10_000);
    input.abort();
    expect(operation.signal.aborted).toBe(true);
    operation.dispose();
  });
  it("applies a bounded timeout", async () => {
    vi.useFakeTimers();
    const operation = operationSignal(undefined, 5);
    await vi.advanceTimersByTimeAsync(5);
    expect(operation.signal.reason).toBeInstanceOf(ResourceLimitError);
    operation.dispose();
    vi.useRealTimers();
  });
  it("rejects output beyond the hard maximum", () => {
    expect(() => enforceOutputLimit("1234", 3)).toThrow("exceeds");
  });
  it("cleans temporary output after a simulated disk-full write", async () => {
    const unlink = vi.fn(async () => undefined);
    await expect(
      atomicWrite("out.txt", "data", 10, {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => {
          throw new Error("ENOSPC");
        }),
        rename: vi.fn(async () => undefined),
        unlink,
      }),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" });
    expect(unlink).toHaveBeenCalledOnce();
  });
  it("rolls back an interrupted index transaction", async () => {
    const rollback = vi.fn(async () => undefined);
    await expect(
      withRollback(async () => {
        throw new Error("interrupted");
      }, rollback),
    ).rejects.toThrow("interrupted");
    expect(rollback).toHaveBeenCalledOnce();
  });
  it("caps concurrent file work", async () => {
    let active = 0;
    let maximum = 0;
    await mapConcurrent(
      [1, 2, 3, 4],
      2,
      async (value) => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active -= 1;
        return value;
      },
      new AbortController().signal,
    );
    expect(maximum).toBeLessThanOrEqual(2);
  });
});
