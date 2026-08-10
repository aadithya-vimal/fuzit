import { detectAndRedactCredentials } from "../detectors/index.js";

const unsafeKey = /^(?:__proto__|constructor|prototype)$/u;

export function redactSensitiveText(
  value: string,
  maximumBytes = 4096,
): string {
  const detected = detectAndRedactCredentials(value)
    .content.replace(/\[REDACTED:[^\]]+\]/gu, "[REDACTED]")
    .replace(
      /\b((?:api[_-]?key|access[_-]?token|password|secret|token)\s*[:=]\s*)[^\s,;]+/giu,
      "$1[REDACTED]",
    )
    .replace(/:\/\/[^/\s:@]+:[^/\s@]+@/gu, "://[REDACTED]@")
    .replace(/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{16,}\b/gu, "[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/gu, "[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/gu, "[REDACTED]");
  const bytes = Buffer.from(detected, "utf8");
  return bytes.length <= maximumBytes
    ? detected
    : `${bytes.subarray(0, Math.max(0, maximumBytes - 15)).toString("utf8")}[TRUNCATED]`;
}

export function redactErrorData(value: unknown, maximumDepth = 6): unknown {
  const seen = new WeakSet<object>();
  const visit = (input: unknown, depth: number): unknown => {
    if (typeof input === "string") return redactSensitiveText(input);
    if (
      typeof input === "number" ||
      typeof input === "boolean" ||
      input === null
    )
      return input;
    if (typeof input === "bigint") return input.toString();
    if (typeof input !== "object") return `[${typeof input}]`;
    if (seen.has(input)) return "[CIRCULAR]";
    if (depth >= maximumDepth) return "[DEPTH_LIMIT]";
    seen.add(input);
    if (input instanceof Error) {
      return {
        name: redactSensitiveText(input.name),
        message: redactSensitiveText(input.message),
        ...(input.cause === undefined
          ? {}
          : { cause: visit(input.cause, depth + 1) }),
      };
    }
    if (Array.isArray(input))
      return input.slice(0, 32).map((item) => visit(item, depth + 1));
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort().slice(0, 32)) {
      if (!unsafeKey.test(key))
        output[key] = visit(Reflect.get(input, key), depth + 1);
    }
    return output;
  };
  return visit(value, 0);
}

export interface SupportBundleInput {
  readonly productVersion: string;
  readonly checks: readonly {
    readonly surface: string;
    readonly status: "pass" | "warning" | "fail";
    readonly error?: unknown;
  }[];
}

export function createSupportBundlePreview(input: SupportBundleInput) {
  return {
    schemaVersion: 1 as const,
    kind: "fuzit-support-preview" as const,
    productVersion: redactSensitiveText(input.productVersion, 128),
    platform: process.platform,
    architecture: process.arch,
    checks: [...input.checks]
      .sort((left, right) => left.surface.localeCompare(right.surface))
      .slice(0, 32)
      .map((check) => ({
        surface: redactSensitiveText(check.surface, 128),
        status: check.status,
        ...(check.error === undefined
          ? {}
          : { error: redactErrorData(check.error) }),
      })),
    contentIncluded: false as const,
  };
}
