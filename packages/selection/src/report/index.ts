export type SelectionOutcome =
  | "included"
  | "excluded"
  | "redacted"
  | "truncated"
  | "dependency-expanded"
  | "failed-source";

export type ExplanationFormat = "json" | "markdown" | "text" | "xml" | "debug";

export const SELECTION_REPORT_SCHEMA_VERSION = 1 as const;

export interface SelectionEvidence {
  readonly path: string;
  readonly outcome: SelectionOutcome;
  readonly reason: string;
  readonly profile?: string;
  readonly contributions?: Readonly<Record<string, number>>;
  readonly profileWeights?: Readonly<Record<string, number>>;
  readonly aggregateScore?: number;
  readonly graphPath?: readonly string[];
  readonly lifecycle?: { readonly basis: string; readonly confidence: string };
  readonly expansionReason?: string;
  readonly budgetTokens?: number;
  readonly budgetDecision?: string;
  readonly indexState?: string;
  readonly securityDecision?: string;
  readonly omissionReason?: string;
  readonly tieBreak?: string;
}

export interface SelectionReport {
  readonly schemaVersion: 1;
  readonly entries: readonly SelectionEvidence[];
}

const sanitizeString = (value: string): string =>
  [
    ...value
      .replace(
        /\b(?:token|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu,
        "[REDACTED]",
      )
      .replace(/\b[A-Za-z]:[\\/][^\s"'<>]+/gu, "[unsafe-path]")
      .replace(
        /(^|\s)\/(?:Users|home|tmp|var|private|etc)\/[^\s"'<>]+/gu,
        "$1[unsafe-path]",
      ),
  ]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
      );
    })
    .join("");

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)]),
    );
  return value;
};

export function createSelectionReport(
  entries: readonly SelectionEvidence[],
): SelectionReport {
  return {
    schemaVersion: SELECTION_REPORT_SCHEMA_VERSION,
    entries: [...entries].sort((left, right) =>
      left.path.localeCompare(right.path),
    ),
  };
}

export function explainPath(
  report: SelectionReport,
  path: string,
): SelectionEvidence {
  const evidence = report.entries.find((entry) => entry.path === path);
  if (evidence === undefined)
    throw new Error(`No selection evidence for ${sanitizeString(path)}.`);
  return evidence;
}

const linesFor = (unsafeEvidence: SelectionEvidence): string[] => {
  const evidence = sanitizeValue(unsafeEvidence) as SelectionEvidence;
  const record = (label: string, value: unknown) =>
    value === undefined
      ? ""
      : `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`;
  return [
    `${evidence.path}: ${evidence.outcome}`,
    record("reason", evidence.reason),
    record("profile", evidence.profile),
    record("score components", evidence.contributions),
    record("profile weights", evidence.profileWeights),
    record("aggregate score", evidence.aggregateScore),
    record("graph path", evidence.graphPath),
    record("lifecycle", evidence.lifecycle),
    record("expansion reason", evidence.expansionReason),
    evidence.budgetTokens === undefined
      ? ""
      : `budget removed: ${evidence.budgetTokens} tokens`,
    record("budget decision", evidence.budgetDecision),
    record("index state", evidence.indexState),
    record("security decision", evidence.securityDecision),
    record("omission reason", evidence.omissionReason),
    record("tie-break", evidence.tieBreak),
  ].filter(Boolean);
};

export function formatSelectionExplanation(
  evidence: SelectionEvidence,
): string {
  return linesFor(evidence).join("\n");
}

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function renderSelectionExplanation(
  evidence: SelectionEvidence,
  format: ExplanationFormat,
): string {
  const safe = sanitizeValue(evidence) as SelectionEvidence;
  if (format === "json") return `${JSON.stringify(safe)}\n`;
  if (format === "text") return `${linesFor(safe).join("\n")}\n`;
  if (format === "markdown")
    return `### ${safe.path}\n\n${linesFor(safe)
      .slice(1)
      .map((line) => `- ${line}`)
      .join("\n")}\n`;
  if (format === "xml")
    return `<selection schema-version="1"><path>${xmlEscape(safe.path)}</path><outcome>${safe.outcome}</outcome><evidence>${xmlEscape(linesFor(safe).slice(1).join("\n"))}</evidence></selection>\n`;
  return `DEBUG selection-schema=${SELECTION_REPORT_SCHEMA_VERSION}\n${linesFor(safe).join("\n")}\n`;
}

export function renderSelectionFailure(
  error: unknown,
  format: ExplanationFormat,
): string {
  const message = sanitizeString(
    error instanceof Error ? error.message : String(error),
  );
  const evidence: SelectionEvidence = {
    path: "[unavailable]",
    outcome: "failed-source",
    reason: message,
    omissionReason: "selection evidence unavailable",
  };
  return renderSelectionExplanation(evidence, format);
}
