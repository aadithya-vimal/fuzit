import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export class ResourceLimitError extends Error {
  constructor(
    readonly code: "ABORTED" | "TIMEOUT" | "OUTPUT_LIMIT" | "WRITE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ResourceLimitError";
  }
}

export function operationSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { readonly signal: AbortSignal; readonly dispose: () => void } {
  const controller = new AbortController();
  const abort = () =>
    controller.abort(new ResourceLimitError("ABORTED", "Operation cancelled."));
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new ResourceLimitError("TIMEOUT", "Operation timed out."),
      ),
    timeoutMs,
  );
  timer.unref();
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}

export async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, signal: AbortSignal) => Promise<R>,
  signal: AbortSignal,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError("concurrency must be positive");
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        signal.throwIfAborted();
        const index = cursor++;
        results[index] = await worker(values[index]!, signal);
      }
    }),
  );
  return results;
}

export function enforceOutputLimit(
  data: Uint8Array | string,
  maximumBytes: number,
): void {
  const bytes =
    typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
  if (bytes > maximumBytes)
    throw new ResourceLimitError(
      "OUTPUT_LIMIT",
      `Output exceeds ${maximumBytes} bytes.`,
    );
}

interface AtomicWriteOperations {
  readonly mkdir: (
    path: string,
    options: { readonly recursive: true },
  ) => Promise<unknown>;
  readonly writeFile: (
    path: string,
    data: Uint8Array | string,
  ) => Promise<unknown>;
  readonly rename: (source: string, destination: string) => Promise<unknown>;
  readonly unlink: (path: string) => Promise<unknown>;
}

export async function atomicWrite(
  destination: string,
  data: Uint8Array | string,
  maximumBytes: number,
  operations: AtomicWriteOperations = { mkdir, writeFile, rename, unlink },
): Promise<void> {
  enforceOutputLimit(data, maximumBytes);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await operations.mkdir(dirname(destination), { recursive: true });
    await operations.writeFile(temporary, data);
    await operations.rename(temporary, destination);
  } catch (error) {
    await operations.unlink(temporary).catch(() => undefined);
    throw new ResourceLimitError(
      "WRITE_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function withRollback<T>(
  operation: () => Promise<T>,
  rollback: () => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    await rollback();
    throw error;
  }
}
