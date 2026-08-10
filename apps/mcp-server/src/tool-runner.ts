import {
  MAX_OUTPUT_BYTES,
  MAX_TASK_BYTES,
  MAX_TOOL_DURATION_MS,
  assertWithinAllowedRoots,
} from "./config.js";
import { redactSensitiveText } from "@fuzit/security";

export type McpToolResult =
  | { readonly ok: true; readonly payload: unknown }
  | { readonly ok: false; readonly error: string; readonly code: string };

export interface McpCallContext {
  readonly allowedRoots: readonly string[];
  readonly abortSignal?: AbortSignal;
}

export function validateTask(task: unknown): string {
  if (typeof task !== "string" || task.trim().length === 0)
    throw new TypeError("task must be a non-empty string");
  if (Buffer.byteLength(task, "utf8") > MAX_TASK_BYTES)
    throw new RangeError(`task exceeds ${MAX_TASK_BYTES} byte limit`);
  return redactSensitiveText(task, MAX_TASK_BYTES);
}

/**
 * Validate that a root argument is a non-empty string within allowed roots.
 */
export async function validateRoot(
  root: unknown,
  context: McpCallContext,
): Promise<string> {
  if (typeof root !== "string" || root.trim().length === 0) {
    throw new TypeError("root must be a non-empty string");
  }
  const canonical = await realpath(root);
  const matched = assertWithinAllowedRoots(canonical, context.allowedRoots);
  const exact = context.allowedRoots.some((allowed) =>
    process.platform === "win32"
      ? allowed.toLowerCase() === matched.toLowerCase()
      : allowed === matched,
  );
  if (!exact) throw new RangeError(`Unknown workspace root: ${root}`);
  return matched;
}

/**
 * Truncate a JSON-serialisable payload if it exceeds the output size limit.
 */
export function boundPayload(payload: unknown): unknown {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized) <= MAX_OUTPUT_BYTES) return payload;
  return {
    truncated: true,
    bytes: Buffer.byteLength(serialized),
    limit: MAX_OUTPUT_BYTES,
    message: "Response payload exceeded output size limit and was truncated.",
  };
}

/**
 * Run a tool handler with a timeout and optional AbortSignal.
 */
export async function withTimeout<T>(
  handler: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = MAX_TOOL_DURATION_MS,
): Promise<T> {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("tool cancelled");
  }

  const controller = new AbortController();
  const onAbort = () => {
    controller.abort(signal?.reason ?? new Error("tool cancelled"));
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  const timer = setTimeout(
    () => controller.abort(new Error("tool timeout")),
    timeoutMs,
  );

  const abortPromise = new Promise<never>((_, reject) => {
    if (controller.signal.aborted) {
      reject(controller.signal.reason);
      return;
    }
    controller.signal.addEventListener(
      "abort",
      () => reject(controller.signal.reason),
      { once: true },
    );
  });

  try {
    return await Promise.race([handler(controller.signal), abortPromise]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Wrap a tool call to produce a structured McpToolResult, catching errors.
 */
export async function runTool(
  handler: () => Promise<unknown>,
): Promise<McpToolResult> {
  try {
    const payload = await handler();
    return { ok: true, payload: boundPayload(payload) };
  } catch (error) {
    const message = redactSensitiveText(
      error instanceof Error ? error.message : String(error),
    );
    const code =
      error instanceof RangeError
        ? "RANGE_ERROR"
        : error instanceof TypeError
          ? "TYPE_ERROR"
          : "INTERNAL_ERROR";
    return { ok: false, error: message, code };
  }
}
import { realpath } from "node:fs/promises";
