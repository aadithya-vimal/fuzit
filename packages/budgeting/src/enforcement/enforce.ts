export interface BudgetItem {
  readonly id: string;
  readonly content: string;
  readonly mandatory?: boolean;
}
export interface BudgetLimits {
  readonly bytes: number;
  readonly tokens: number;
  readonly files: number;
  readonly perItemBytes: number;
  readonly manifestBytes: number;
}
export function enforceBudget(
  items: readonly BudgetItem[],
  limits: BudgetLimits,
) {
  let bytes = limits.manifestBytes;
  let tokens = Math.ceil(bytes / 4);
  const selected: { id: string; content: string; truncated: boolean }[] = [];
  const excluded: { id: string; reason: string }[] = [];
  for (const item of items) {
    if (selected.length >= limits.files) {
      excluded.push({ id: item.id, reason: "file limit" });
      continue;
    }
    const available = Math.max(
      0,
      Math.min(
        limits.perItemBytes,
        limits.bytes - bytes,
        (limits.tokens - tokens) * 4,
      ),
    );
    if (available === 0) {
      excluded.push({
        id: item.id,
        reason: item.mandatory
          ? "mandatory item exceeds budget"
          : "budget exhausted",
      });
      continue;
    }
    const buffer = Buffer.from(item.content);
    const content = buffer
      .subarray(0, available)
      .toString("utf8")
      .replace(/\uFFFD$/, "");
    const used = Buffer.byteLength(content);
    selected.push({ id: item.id, content, truncated: used < buffer.length });
    bytes += used;
    tokens += Math.ceil(used / 4);
  }
  return {
    selected,
    excluded,
    bytes,
    tokens,
    overflow: bytes > limits.bytes || tokens > limits.tokens,
  };
}
