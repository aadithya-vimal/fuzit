import type { ContextProfile } from "@fuzit/schemas";

import {
  assertSecurityFilteredItem,
  type SecurityFilteredItem,
} from "../pipeline/security-filter.js";

export interface ContextEvidence {
  readonly path: string;
  readonly components: Readonly<Record<string, number>>;
  readonly weights: Readonly<Record<string, number>>;
  readonly score: number;
  readonly decision: "selected" | "excluded";
  readonly reason: string;
  readonly redacted: boolean;
}

export interface ContextResult {
  readonly schemaVersion: 1;
  readonly task: string;
  readonly profile: string;
  readonly selected: readonly {
    path: string;
    content: string;
    reason: string;
  }[];
  readonly excluded: readonly { path: string; reason: string }[];
  readonly budget: { tokens: number; used: number };
  readonly evidence?: readonly ContextEvidence[];
  readonly index: "used" | "bypassed" | "unavailable";
}

function terms(value: string): string[] {
  return value
    .normalize("NFKC")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_/\\.-]+/g, " ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);
}

function components(
  task: string,
  item: SecurityFilteredItem,
): Record<string, number> {
  const searchable = terms(`${item.path} ${item.content ?? ""}`);
  const lexical = terms(task).reduce(
    (score, term) =>
      score + searchable.filter((value) => value === term).length,
    0,
  );
  const path = item.path.toLowerCase();
  const content = (item.content ?? "").toLowerCase();
  return {
    lexical,
    git: 0,
    test: /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\./.test(path)
      ? 1
      : 0,
    dependency:
      /(?:package\.json|pnpm-workspace\.yaml|requirements.*\.txt|pom\.xml|go\.mod)$/.test(
        path,
      ) || /\b(?:import|require|dependencies)\b/.test(content)
        ? 1
        : 0,
    manifest:
      /(?:package\.json|pnpm-workspace\.yaml|pyproject\.toml|pom\.xml|go\.mod)$/.test(
        path,
      )
        ? 1
        : 0,
    doc: /\.(?:md|mdx|rst|txt)$/.test(path) ? 1 : 0,
    security:
      /\b(?:auth|authentication|authorization|credential|secret|token|security)\b/.test(
        `${path} ${content}`,
      )
        ? 1
        : 0,
  };
}

export function createTaskContext(input: {
  readonly items: readonly SecurityFilteredItem[];
  readonly task: string;
  readonly profile: ContextProfile;
  readonly budgetTokens: number;
  readonly explain?: boolean;
  readonly index?: ContextResult["index"];
  readonly omissions?: readonly { path: string; reason: string }[];
}): ContextResult {
  for (const item of input.items) assertSecurityFilteredItem(item);
  if (!Number.isInteger(input.budgetTokens) || input.budgetTokens <= 0)
    throw new TypeError("Budget tokens must be a positive integer.");

  const ranked = input.items
    .map((item) => {
      const values = components(input.task, item);
      const score = Object.entries(values).reduce(
        (total, [source, value]) =>
          total + value * (input.profile.weights[source] ?? 0),
        0,
      );
      return { item, values, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.item.path.localeCompare(right.item.path, "en"),
    );
  const selected: { path: string; content: string; reason: string }[] = [];
  const excluded = [...(input.omissions ?? [])];
  const evidence: ContextEvidence[] = [];
  let used = 0;
  for (const candidate of ranked) {
    const content = candidate.item.content ?? "";
    const tokens = Math.ceil(Buffer.byteLength(content) / 4);
    let reason = `weighted score ${candidate.score}`;
    let decision: ContextEvidence["decision"] = "selected";
    if (candidate.score <= 0) {
      reason = "not relevant to task/profile";
      decision = "excluded";
    } else if (used + tokens > input.budgetTokens) {
      reason = "budget";
      decision = "excluded";
    } else {
      used += tokens;
      selected.push({ path: candidate.item.path, content, reason });
    }
    if (decision === "excluded")
      excluded.push({ path: candidate.item.path, reason });
    evidence.push({
      path: candidate.item.path,
      components: candidate.values,
      weights: input.profile.weights,
      score: candidate.score,
      decision,
      reason,
      redacted: candidate.item.findings.length > 0,
    });
  }
  return {
    schemaVersion: 1,
    task: input.task,
    profile: input.profile.id,
    selected,
    excluded: excluded.sort((a, b) => a.path.localeCompare(b.path, "en")),
    budget: { tokens: input.budgetTokens, used },
    ...(input.explain ? { evidence } : {}),
    index: input.index ?? "unavailable",
  };
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderTaskContext(
  result: ContextResult,
  format: "markdown" | "json" | "text" | "xml",
): string {
  if (format === "json") return `${JSON.stringify(result, null, 2)}\n`;
  if (format === "xml")
    return `<context task="${xml(result.task)}" profile="${xml(result.profile)}">${result.selected.map((item) => `<file path="${xml(item.path)}">${xml(item.content)}</file>`).join("")}</context>\n`;
  if (format === "text")
    return `${result.selected
      .map((item) => `=== ${item.path} ===\n${item.content}`)
      .join("\n")}\n`;
  return `# Fuzit context\n\nTask: ${result.task}\nProfile: ${result.profile}\n\n${result.selected.map((item) => `## ${item.path}\n\n\`\`\`\n${item.content}\n\`\`\``).join("\n\n")}\n`;
}
