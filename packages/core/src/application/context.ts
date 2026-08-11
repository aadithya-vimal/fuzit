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
    .filter((term) => term.length > 1)
    .map((term) => {
      if (/^auth(?:enticate|enticated|entication|orization|orize)?$/.test(term))
        return "auth";
      if (/^tests?$/.test(term)) return "test";
      if (/^implement(?:ation|ed|ing)?$/.test(term)) return "implementation";
      return term;
    });
}

type SourceCategory =
  "documentation" | "historical" | "implementation" | "test" | "other";

function sourceCategory(item: SecurityFilteredItem): SourceCategory {
  const path = item.path.toLowerCase();
  const contentPrefix = (item.content ?? "").slice(0, 4_000).toLowerCase();
  const documentation = /\.(?:md|mdx|rst|txt)$/.test(path);
  if (
    documentation &&
    (/(?:^|\/)docs\/archive(?:\/|$)/.test(path) ||
      /\b(?:historical|archived|non-authoritative|superseded|no longer (?:current|authoritative)|legacy reference)\b/.test(
        contentPrefix,
      ))
  )
    return "historical";
  if (documentation) return "documentation";
  if (/(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\./.test(path))
    return "test";
  if (
    /\.(?:[cm]?[jt]sx?|py|go|java|rs|rb|php|cs|c|cc|cpp|h|hpp|swift|kt|kts)$/.test(
      path,
    )
  )
    return "implementation";
  return "other";
}

function requestedCategories(task: string): SourceCategory[] {
  const taskTerms = new Set(terms(task));
  return [
    ...(taskTerms.has("architecture") ? (["documentation"] as const) : []),
    ...(taskTerms.has("implementation") ? (["implementation"] as const) : []),
    ...(taskTerms.has("test") ? (["test"] as const) : []),
  ];
}

function taskConceptTerms(task: string): string[] {
  const normalized = new Set(terms(task));
  if (normalized.has("auth")) {
    for (const related of ["security", "identity", "jwt", "session", "login"])
      normalized.add(related);
  }
  return [...normalized];
}

function components(
  task: string,
  item: SecurityFilteredItem,
): Record<string, number> {
  const taskTerms = taskConceptTerms(task);
  const contentTerms = terms(item.content ?? "");
  const pathTerms = terms(item.path);
  const lengthNormalization = Math.sqrt(Math.max(1, contentTerms.length / 100));
  const lexical = taskTerms.reduce((score, term) => {
    const contentFrequency = contentTerms.filter(
      (value) => value === term,
    ).length;
    const pathFrequency = pathTerms.filter((value) => value === term).length;
    return (
      score +
      Math.min(contentFrequency, 3) / lengthNormalization +
      pathFrequency * 3
    );
  }, 0);
  const path = item.path.toLowerCase();
  const content = (item.content ?? "").toLowerCase();
  const normalizedTask = task
    .normalize("NFKC")
    .replaceAll("\\", "/")
    .toLowerCase();
  const explicitlyMentioned =
    normalizedTask.includes(path) ||
    normalizedTask.includes(path.split("/").at(-1) ?? path);
  const generatedArtifact =
    item.lifecycle === "generated" ||
    /(?:^|\/)(?:fuzit[-_.](?:pack|context|evidence)|final_audit_evidence)(?:[-_.]|$)/i.test(
      path,
    ) ||
    /^(?:# Fuzit (?:context|pack)|\{\s*"kind"\s*:\s*"fuzit-)/i.test(content);
  const category = sourceCategory(item);
  const pathTopicMatch =
    category === "documentation" &&
    taskTerms.some(
      (term) =>
        pathTerms.includes(term) &&
        path.split("/").at(-1)?.split(".")[0]?.includes(term),
    );
  return {
    lexical,
    pathTopic: taskTerms.filter((term) => pathTerms.includes(term)).length,
    exact: explicitlyMentioned ? 25 : 0,
    generated: generatedArtifact ? 1 : 0,
    historical: category === "historical" ? 1 : 0,
    authority: pathTopicMatch ? 1 : 0,
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
          total +
          (source === "generated"
            ? value * -1_000
            : source === "historical"
              ? value * -40
              : source === "authority"
                ? value * 12
                : source === "pathTopic"
                  ? value * 6
                  : value * (input.profile.weights[source] ?? 0)),
        0,
      );
      const content = item.content ?? "";
      return {
        item,
        values,
        score,
        category: sourceCategory(item),
        tokens: Math.ceil(Buffer.byteLength(content) / 4),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.item.path.localeCompare(right.item.path, "en"),
    );
  const selected: { path: string; content: string; reason: string }[] = [];
  const excluded = [...(input.omissions ?? [])];
  const evidence: ContextEvidence[] = [];
  const decisions = new Map<
    string,
    { decision: ContextEvidence["decision"]; reason: string }
  >();
  let used = 0;
  const categoryTokens = new Map<SourceCategory, number>();
  const requested = requestedCategories(input.task);
  const anchors = requested.flatMap((category) =>
    ranked
      .filter(
        (candidate) =>
          candidate.category === category &&
          candidate.score > 0 &&
          (category === "documentation" ||
            candidate.values.pathTopic! > 0 ||
            candidate.values.exact! > 0),
      )
      .slice(
        0,
        category === "implementation" ? 4 : category === "test" ? 3 : 1,
      ),
  );
  const anchorPaths = new Set(anchors.map(({ item }) => item.path));
  const selectionOrder = [
    ...anchors,
    ...ranked.filter(({ item }) => !anchorPaths.has(item.path)),
  ];
  const diverseTask =
    requested.includes("implementation") && requested.includes("test");

  for (const candidate of selectionOrder) {
    const content = candidate.item.content ?? "";
    const tokens = candidate.tokens;
    let reason = `weighted score ${candidate.score}`;
    let decision: ContextEvidence["decision"] = "selected";
    const isAnchor = anchorPaths.has(candidate.item.path);
    const categoryLimit =
      diverseTask && candidate.category === "documentation"
        ? Math.floor(input.budgetTokens * 0.25)
        : diverseTask && candidate.category === "test"
          ? Math.floor(input.budgetTokens * 0.35)
          : input.budgetTokens;
    if (candidate.score <= 0) {
      reason = "not relevant to task/profile";
      decision = "excluded";
    } else if (
      diverseTask &&
      (candidate.category === "implementation" ||
        candidate.category === "test") &&
      candidate.values.lexical! <= 0 &&
      candidate.values.exact! <= 0
    ) {
      reason = "not topically relevant to requested source category";
      decision = "excluded";
    } else if (
      (categoryTokens.get(candidate.category) ?? 0) + tokens >
      categoryLimit
    ) {
      reason = `${candidate.category} diversity budget`;
      decision = "excluded";
    } else if (used + tokens > input.budgetTokens) {
      reason = "budget";
      decision = "excluded";
    } else {
      used += tokens;
      categoryTokens.set(
        candidate.category,
        (categoryTokens.get(candidate.category) ?? 0) + tokens,
      );
      if (isAnchor)
        reason = `${candidate.category} intent anchor; weighted score ${candidate.score}`;
      selected.push({ path: candidate.item.path, content, reason });
    }
    if (decision === "excluded")
      excluded.push({ path: candidate.item.path, reason });
    decisions.set(candidate.item.path, { decision, reason });
  }
  for (const candidate of ranked) {
    const outcome = decisions.get(candidate.item.path)!;
    evidence.push({
      path: candidate.item.path,
      components: candidate.values,
      weights: input.profile.weights,
      score: candidate.score,
      decision: outcome.decision,
      reason: outcome.reason,
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
