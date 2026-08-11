type MaybeRecord = Record<string, unknown>;

export interface Theme {
  readonly color: boolean;
  readonly unicode: boolean;
}

export function resolveTheme(overrides?: Partial<Theme>): Theme {
  const color =
    overrides?.color !== undefined
      ? overrides.color
      : process.env.NO_COLOR === undefined && Boolean(process.stdout.isTTY);
  const unicode =
    overrides?.unicode !== undefined
      ? overrides.unicode
      : Boolean(process.stdout.isTTY);
  return { color, unicode };
}

const ANSI = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  cyan: "\u001B[36m",
  blue: "\u001B[34m",
};

// Maximum visible character width for a box body line.
// Keeps output safe on 80-column terminals; borders add 4 chars.
const MAX_BOX_INNER_WIDTH = 76;

function paint(theme: Theme, code: string, value: string): string {
  return theme.color ? `${code}${value}${ANSI.reset}` : value;
}

function icon(theme: Theme, name: "success" | "error" | "warning" | "info" | "next") {
  if (!theme.unicode) {
    return { success: "OK", error: "ERR", warning: "WARN", info: "INFO", next: "->" }[name];
  }
  return { success: "✓", error: "✖", warning: "⚠", info: "ℹ", next: "→" }[name];
}

/** Truncate a string to at most `max` visible characters, adding "…" if cut. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function box(theme: Theme, title: string, body: string[]): string {
  const cappedTitle = truncate(title, MAX_BOX_INNER_WIDTH);
  const cappedBody = body.map((line) => truncate(line, MAX_BOX_INNER_WIDTH));

  const innerWidth = Math.min(
    MAX_BOX_INNER_WIDTH,
    Math.max(
      cappedTitle.length,
      ...cappedBody.map((line) => line.length),
    ),
  );
  // Total line width = 1 (border) + 1 (space) + innerWidth + 1 (space) + 1 (border) = innerWidth + 4
  const fillWidth = innerWidth + 2;
  const fill = theme.unicode ? "─".repeat(fillWidth) : "-".repeat(fillWidth);
  const top = `${theme.unicode ? "╭" : "+"}${fill}${theme.unicode ? "╮" : "+"}`;
  const bottom = `${theme.unicode ? "╰" : "+"}${fill}${theme.unicode ? "╯" : "+"}`;
  const titleLine = `${theme.unicode ? "│" : "|"} ${paint(theme, ANSI.bold, cappedTitle.padEnd(innerWidth))} ${theme.unicode ? "│" : "|"}`;
  const padded = cappedBody.map((line) => `${theme.unicode ? "│" : "|"} ${line.padEnd(innerWidth)} ${theme.unicode ? "│" : "|"}`);
  return [top, titleLine, ...padded, bottom].join("\n");
}

function pair(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function statusColor(theme: Theme, status: string, ok: string, warn?: string): string {
  if (status === ok) return paint(theme, ANSI.green, status.toUpperCase());
  if (warn && status === warn) return paint(theme, ANSI.yellow, status.toUpperCase());
  return paint(theme, ANSI.yellow, status.toUpperCase());
}

function formatCounts(counts: MaybeRecord): string[] {
  return [
    pair("Files", String(counts.files ?? 0)),
    pair("Directories", String(counts.directories ?? 0)),
    pair("Symlinks", String(counts.symlinks ?? 0)),
  ];
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function formatScan(value: MaybeRecord, theme: Theme): string {
  const lines = [
    pair("Repository", truncate(String(value.root ?? "."), 55)),
    "",
    ...formatCounts((value.counts as MaybeRecord) ?? {}),
    "",
    pair(
      "Status",
      paint(
        theme,
        value.status === "complete" ? ANSI.green : ANSI.yellow,
        String(value.status ?? "unknown").toUpperCase(),
      ),
    ),
  ];
  if (Array.isArray(value.nextSteps) && value.nextSteps.length > 0) {
    lines.push("", "Next steps");
    for (const step of value.nextSteps.slice(0, 3)) {
      lines.push(`${icon(theme, "next")} ${String(step)}`);
    }
  }
  return box(theme, "Fuzit · Repository Scan", lines);
}

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

function formatPack(value: MaybeRecord, theme: Theme): string {
  const redactions = value.redactions as MaybeRecord | undefined;
  const findings = Number(redactions?.findings ?? 0);
  const redactedItems = Number(redactions?.redactedItems ?? 0);
  const omittedItems = Number(redactions?.omittedItems ?? 0);
  const selected = (value.selected as unknown[] | undefined) ?? [];
  const lines = [
    pair("Selected files", String(selected.length)),
    pair("Redaction findings", paint(theme, findings > 0 ? ANSI.yellow : ANSI.green, String(findings))),
    pair("Redacted items", paint(theme, redactedItems > 0 ? ANSI.yellow : ANSI.green, String(redactedItems))),
    pair("Omitted items", paint(theme, omittedItems > 0 ? ANSI.yellow : ANSI.green, String(omittedItems))),
  ];
  if (typeof value.output === "string") lines.push("", pair("Output", truncate(value.output, 55)));
  return box(theme, "Fuzit · Repository Pack", lines);
}

// ---------------------------------------------------------------------------
// Graph Stats
// ---------------------------------------------------------------------------

export function formatGraphStats(value: MaybeRecord, theme: Theme): string {
  const lines = [
    pair("Nodes", String(value.nodes ?? 0)),
    pair("Edges", String(value.edges ?? 0)),
    pair(
      "Completeness",
      paint(
        theme,
        value.completeness === "complete" ? ANSI.green : ANSI.yellow,
        String(value.completeness ?? "unknown").toUpperCase(),
      ),
    ),
  ];
  const nodeKinds = value.nodeKinds as MaybeRecord | undefined;
  if (nodeKinds && Object.keys(nodeKinds).length > 0) {
    lines.push("", "Node kinds");
    for (const [kind, count] of Object.entries(nodeKinds)) lines.push(pair(kind, String(count)));
  }
  const edgeKinds = value.edgeKinds as MaybeRecord | undefined;
  if (edgeKinds && Object.keys(edgeKinds).length > 0) {
    lines.push("", "Edge kinds");
    for (const [kind, count] of Object.entries(edgeKinds)) lines.push(pair(kind, String(count)));
  }
  lines.push("", pair("Diagnostics", String((value.diagnostics as unknown[] | undefined)?.length ?? 0)));
  return box(theme, "Fuzit · Graph Statistics", lines);
}

// ---------------------------------------------------------------------------
// Graph Build
// ---------------------------------------------------------------------------

export function formatGraphBuild(value: MaybeRecord, theme: Theme): string {
  return box(theme, "Fuzit · Repository Graph", [
    pair("Nodes", String(value.nodes ?? 0)),
    pair("Edges", String(value.edges ?? 0)),
    pair("Completeness", String(value.completeness ?? "unknown").toUpperCase()),
    "",
    pair("Output", truncate(String(value.output ?? ""), 55)),
  ]);
}

// ---------------------------------------------------------------------------
// Graph Query / Neighbors / Impact
// ---------------------------------------------------------------------------

function formatGraphQuery(value: MaybeRecord, theme: Theme): string {
  const results = Array.isArray(value.results) ? value.results : [];
  const lines = [
    pair("Results", String(results.length)),
  ];
  if (value.truncated) lines.push(pair("Truncated", paint(theme, ANSI.yellow, "YES")));
  if (results.length > 0) {
    lines.push("", "Results");
    for (const result of results.slice(0, 12)) {
      if (typeof result === "string") {
        lines.push(truncate(result, MAX_BOX_INNER_WIDTH - 2));
      } else if (result && typeof result === "object") {
        const record = result as MaybeRecord;
        lines.push(
          truncate(
            `${String(record.kind ?? "node").toUpperCase()}: ${String(record.path ?? record.id ?? "")}`,
            MAX_BOX_INNER_WIDTH - 2,
          ),
        );
      }
    }
    if (results.length > 12) {
      lines.push(`… and ${results.length - 12} more`);
    }
  }
  const diagnostics = Array.isArray(value.diagnostics) ? value.diagnostics : [];
  if (diagnostics.length > 0) {
    lines.push("", "Diagnostics");
    for (const diagnostic of diagnostics.slice(0, 5)) lines.push(truncate(String(diagnostic), MAX_BOX_INNER_WIDTH - 2));
  }
  return box(theme, "Fuzit · Repository Graph Query", lines);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function formatAuth(value: MaybeRecord, theme: Theme): string {
  const isAuthenticated =
    value.status === "Authenticated" || value.status === "Already authenticated";
  const lines = [
    pair(
      "Status",
      paint(
        theme,
        isAuthenticated
          ? ANSI.green
          : value.status === "Not authenticated"
            ? ANSI.yellow
            : ANSI.red,
        String(value.status ?? "unknown"),
      ),
    ),
    pair("Host", String(value.host ?? "github.com")),
  ];
  if (typeof value.account === "string") lines.push(pair("Account", value.account));
  if (typeof value.source === "string") lines.push(pair("Source", value.source));
  if (typeof value.permission === "string") {
    // permission is a required capability, not a verified scope claim
    lines.push("", pair("Required for review", value.permission));
  }
  if (typeof value.error === "string") lines.push("", paint(theme, ANSI.red, truncate(value.error, MAX_BOX_INNER_WIDTH - 4)));
  if (typeof value.nextStep === "string") lines.push("", `Next: ${value.nextStep}`);
  return box(theme, "Fuzit · GitHub Authentication", lines);
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

function formatReview(value: MaybeRecord, theme: Theme): string {
  const findings = Array.isArray(value.findings) ? value.findings : [];
  const lines: string[] = [
    pair("Repository", truncate(String(value.repository ?? ""), 55)),
    pair("PR", `#${String(value.prNumber ?? "")}`),
  ];
  if (typeof value.title === "string") lines.push(pair("Title", truncate(value.title, 55)));
  if (typeof value.state === "string") lines.push(pair("State", value.state.toUpperCase()));
  if (typeof value.author === "string") lines.push(pair("Author", value.author));
  if (typeof value.baseRef === "string" && typeof value.headRef === "string") {
    lines.push(pair("Branch", `${value.baseRef} ← ${value.headRef}`));
  }
  lines.push("", "Findings");
  if (findings.length === 0) {
    lines.push(paint(theme, ANSI.green, "No high-confidence findings detected."));
  } else {
    lines.push(paint(theme, ANSI.yellow, `${findings.length} finding(s) detected`));
    for (const finding of (findings as MaybeRecord[]).slice(0, 5)) {
      const severity = typeof finding.severity === "string" ? finding.severity : "info";
      const message = truncate(
        typeof finding.message === "string"
          ? finding.message
          : typeof finding.description === "string"
            ? finding.description
            : String(finding),
        MAX_BOX_INNER_WIDTH - 8,
      );
      const color = severity === "error" ? ANSI.red : severity === "warning" ? ANSI.yellow : ANSI.cyan;
      lines.push(`  ${paint(theme, color, severity.toUpperCase())} ${message}`);
    }
    if (findings.length > 5) lines.push(`  … and ${findings.length - 5} more`);
  }
  if (typeof value.summary === "string") {
    // Render a bounded excerpt of the summary (first 3 non-empty lines)
    const summaryLines = value.summary
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (summaryLines.length > 0) {
      lines.push("", "Summary excerpt");
      for (const line of summaryLines) {
        lines.push(truncate(line, MAX_BOX_INNER_WIDTH - 2));
      }
    }
  }
  if (typeof value.output === "string") lines.push("", pair("Saved to", truncate(value.output, 55)));
  return box(theme, "Fuzit · Pull Request Review", lines);
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function formatError(value: MaybeRecord, theme: Theme): string {
  const message = truncate(String(value.error ?? value.message ?? "Unknown error."), MAX_BOX_INNER_WIDTH - 4);
  return box(theme, "Fuzit Error", [
    paint(theme, ANSI.red, `${icon(theme, "error")} ${message}`),
  ]);
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export function formatDoctorReport(
  report: { status: string; checks: Array<{ id: string; status: string; message: string }> },
  theme: Theme = resolveTheme({ color: false, unicode: false }),
): string {
  const statusBadge =
    report.status === "ready"
      ? paint(theme, ANSI.green, "READY")
      : paint(theme, ANSI.yellow, report.status.toUpperCase());
  const lines: string[] = [pair("Status", statusBadge), ""];
  for (const check of report.checks) {
    const label =
      check.status === "pass"
        ? paint(theme, ANSI.green, "PASS")
        : check.status === "warning"
          ? paint(theme, ANSI.yellow, "WARN")
          : paint(theme, ANSI.red, "FAIL");
    lines.push(`${label} ${check.id}: ${truncate(check.message, MAX_BOX_INNER_WIDTH - check.id.length - 8)}`);
  }
  return box(theme, "Fuzit · Environment Check", lines);
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

function formatGitStatus(value: MaybeRecord, theme: Theme): string {
  const changes = Array.isArray(value.changes) ? value.changes : [];
  const lines: string[] = [pair("Changes", String(changes.length)), ""];
  for (const change of (changes as MaybeRecord[]).slice(0, 20)) {
    const status = String(change.status ?? change.kind ?? "?").padEnd(8);
    const file = truncate(String(change.path ?? change.file ?? ""), MAX_BOX_INNER_WIDTH - 10);
    lines.push(`${status} ${file}`);
  }
  if (changes.length > 20) lines.push(`… and ${changes.length - 20} more`);
  if (changes.length === 0) lines.push(paint(theme, ANSI.green, "Working tree clean"));
  return box(theme, "Fuzit · Git Status", lines);
}

function formatGitLog(value: MaybeRecord, theme: Theme): string {
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const lines: string[] = [pair("Commits", String(entries.length)), ""];
  for (const entry of (entries as MaybeRecord[]).slice(0, 15)) {
    const hash = truncate(String(entry.hash ?? entry.sha ?? entry.commit ?? "").slice(0, 8), 8);
    const msg = truncate(String(entry.message ?? entry.subject ?? ""), MAX_BOX_INNER_WIDTH - 12);
    const author = truncate(String(entry.author ?? ""), 16);
    lines.push(`${hash} ${author.padEnd(16)} ${msg}`);
  }
  if (entries.length > 15) lines.push(`… and ${entries.length - 15} more`);
  return box(theme, "Fuzit · Git Log", lines);
}

function formatGitDiff(value: MaybeRecord, theme: Theme): string {
  const files = Array.isArray(value.files)
    ? value.files
    : Array.isArray((value as MaybeRecord).changedFiles)
      ? (value as MaybeRecord).changedFiles as unknown[]
      : [];
  const base = typeof value.base === "string" ? value.base : "HEAD";
  const lines: string[] = [
    pair("Base", truncate(base, 55)),
    pair("Changed files", String(files.length)),
  ];
  for (const f of (files as MaybeRecord[]).slice(0, 20)) {
    lines.push(truncate(`  ${String(f.path ?? f.file ?? f)}`, MAX_BOX_INNER_WIDTH - 2));
  }
  if (files.length > 20) lines.push(`  … and ${files.length - 20} more`);
  return box(theme, "Fuzit · Git Diff", lines);
}

function formatGitBlame(value: MaybeRecord, theme: Theme): string {
  const lines_arr = Array.isArray(value.lines) ? value.lines : [];
  const lines: string[] = [pair("Lines", String(lines_arr.length)), ""];
  for (const entry of (lines_arr as MaybeRecord[]).slice(0, 15)) {
    const num = String(entry.line ?? entry.lineNumber ?? "").padStart(4);
    const hash = truncate(String(entry.hash ?? entry.commit ?? "").slice(0, 8), 8);
    const content = truncate(String(entry.content ?? ""), MAX_BOX_INNER_WIDTH - 16);
    lines.push(`${num} ${hash} ${content}`);
  }
  if (lines_arr.length > 15) lines.push(`… and ${lines_arr.length - 15} more`);
  return box(theme, "Fuzit · Git Blame", lines);
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function formatCacheResult(kind: string, value: MaybeRecord, theme: Theme): string {
  const lines: string[] = [];
  if (typeof value.path === "string") lines.push(pair("Path", truncate(value.path, 55)));
  if (typeof value.repositoryId === "string") lines.push(pair("Repository ID", truncate(value.repositoryId.slice(0, 32), 32)));
  if (typeof value.state === "string") {
    lines.push(pair("State", statusColor(theme, value.state, "ready", "stale")));
  }
  if (typeof value.valid === "boolean") {
    lines.push(pair("Valid", value.valid ? paint(theme, ANSI.green, "YES") : paint(theme, ANSI.red, "NO")));
  }
  if (typeof value.rebuildRequired === "boolean" && value.rebuildRequired) {
    lines.push(pair("Rebuild required", paint(theme, ANSI.yellow, "YES")));
  }
  if (Array.isArray(value.reasons) && value.reasons.length > 0) {
    lines.push("", "Reasons");
    for (const r of (value.reasons as string[]).slice(0, 5)) lines.push(`  ${truncate(r, MAX_BOX_INNER_WIDTH - 4)}`);
  }
  if (typeof value.dryRun === "boolean") lines.push("", pair("Dry run", value.dryRun ? "YES" : "NO"));
  if (typeof value.action === "string") lines.push(pair("Action", truncate(value.action, 55)));
  const decision = value.decision as MaybeRecord | undefined;
  if (decision && typeof decision.action === "string") {
    lines.push("", pair("Decision", decision.action.toUpperCase()));
    if (Array.isArray(decision.reasons)) {
      for (const r of (decision.reasons as string[]).slice(0, 3)) lines.push(`  ${truncate(r, MAX_BOX_INNER_WIDTH - 4)}`);
    }
  }
  const titles: Record<string, string> = {
    "cache-init": "Fuzit · Cache Init",
    "cache-status": "Fuzit · Cache Status",
    "cache-rebuild": "Fuzit · Cache Rebuild",
    "cache-verify": "Fuzit · Cache Verify",
    "cache-purge": "Fuzit · Cache Purge",
  };
  return box(theme, titles[kind] ?? "Fuzit · Cache", lines);
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

function formatSnapshotCreate(value: MaybeRecord, theme: Theme): string {
  const lines: string[] = [];
  if (typeof value.id === "string") lines.push(pair("ID", truncate(value.id, 55)));
  if (typeof value.repositoryRevision === "string") lines.push(pair("Revision", truncate(value.repositoryRevision, 40)));
  if (typeof value.dirty === "boolean") lines.push(pair("Dirty", value.dirty ? paint(theme, ANSI.yellow, "YES") : "NO"));
  if (typeof value.complete === "boolean") {
    lines.push(pair("Complete", value.complete ? paint(theme, ANSI.green, "YES") : paint(theme, ANSI.yellow, "NO")));
  }
  const diags = Array.isArray(value.diagnostics) ? value.diagnostics : [];
  lines.push(pair("Diagnostics", String(diags.length)));
  return box(theme, "Fuzit · Snapshot Created", lines);
}

function formatSnapshotList(value: unknown, theme: Theme): string {
  const items = Array.isArray(value) ? value : [];
  const lines: string[] = [pair("Snapshots", String(items.length)), ""];
  for (const item of (items as MaybeRecord[]).slice(0, 15)) {
    const id = truncate(String(item.id ?? ""), 55);
    const rev = truncate(String(item.repositoryRevision ?? ""), 20);
    lines.push(`${id}  ${rev}`);
  }
  if (items.length > 15) lines.push(`… and ${items.length - 15} more`);
  if (items.length === 0) lines.push("No snapshots found.");
  return box(theme, "Fuzit · Snapshots", lines);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function formatConfig(value: MaybeRecord, theme: Theme): string {
  const vals = (value.values as MaybeRecord) ?? {};
  const prov = (value.provenance as MaybeRecord) ?? {};
  const lines: string[] = [];
  for (const [key, val] of Object.entries(vals)) {
    const source = String(prov[key] ?? "");
    const sourceLabel = source !== "default" ? paint(theme, ANSI.dim, `(${source})`) : paint(theme, ANSI.dim, "(default)");
    const display = Array.isArray(val) ? (val.length === 0 ? "[]" : val.join(", ")) : String(val);
    lines.push(`${key.padEnd(18)} ${truncate(display, 40).padEnd(40)} ${sourceLabel}`);
  }
  return box(theme, "Fuzit · Effective Configuration", lines);
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

function formatSupport(value: MaybeRecord, theme: Theme): string {
  const checks = Array.isArray(value.checks) ? value.checks : [];
  const lines: string[] = [];
  if (typeof value.productVersion === "string") lines.push(pair("Version", value.productVersion));
  if (typeof value.id === "string") lines.push(pair("Bundle ID", truncate(value.id, 40)));
  if (checks.length > 0) {
    lines.push("", "Checks");
    for (const check of (checks as MaybeRecord[]).slice(0, 10)) {
      const status = String(check.status ?? "");
      const surface = String(check.surface ?? "");
      const label = status === "pass"
        ? paint(theme, ANSI.green, "PASS")
        : paint(theme, ANSI.yellow, status.toUpperCase());
      lines.push(`${label} ${surface}`);
    }
  }
  return box(theme, "Fuzit · Support Bundle Preview", lines);
}

// ---------------------------------------------------------------------------
// Profile list
// ---------------------------------------------------------------------------

function formatProfileList(value: unknown, theme: Theme): string {
  const profiles = Array.isArray(value) ? value : (value && typeof value === "object" ? Object.values(value) : []);
  const lines: string[] = [pair("Profiles", String(profiles.length)), ""];
  for (const p of (profiles as MaybeRecord[]).slice(0, 20)) {
    const name = truncate(String(p.name ?? p.id ?? ""), 22);
    const desc = truncate(String(p.description ?? ""), MAX_BOX_INNER_WIDTH - 26);
    lines.push(`${name.padEnd(22)} ${desc}`);
  }
  return box(theme, "Fuzit · Built-in Profiles", lines);
}

// ---------------------------------------------------------------------------
// Context result (when output written to file)
// ---------------------------------------------------------------------------

function formatContextResult(value: MaybeRecord, theme: Theme): string {
  const selected = Array.isArray(value.selected) ? value.selected : [];
  const lines: string[] = [
    pair("Selected files", String(selected.length)),
  ];
  if (typeof value.output === "string") lines.push(pair("Output", truncate(value.output, 55)));
  const report = value.report as MaybeRecord | undefined;
  if (report) {
    if (typeof report.budgetTokens === "number") lines.push(pair("Budget tokens", String(report.budgetTokens)));
    if (typeof report.usedTokens === "number") lines.push(pair("Used tokens", String(report.usedTokens)));
  }
  return box(theme, "Fuzit · Task Context", lines);
}

// ---------------------------------------------------------------------------
// Repository Roots
// ---------------------------------------------------------------------------

function formatRepositoryRoots(value: MaybeRecord, theme: Theme): string {
  const nested = (value.nestedRoots as unknown[] | undefined) ?? [];
  return box(theme, "Fuzit · Repository Roots", [
    pair("Selected root", truncate(String(value.selectedRoot ?? "."), 55)),
    pair("Nested roots", String(nested.length)),
  ]);
}

function formatIssueResult(value: MaybeRecord, theme: Theme): string {
  const result = (value.result as MaybeRecord) ?? value;
  const lines: string[] = [];
  if (result.targetRepo || value.repository) {
    lines.push(pair("Repository", truncate(String(result.targetRepo ?? value.repository ?? ""), 55)));
  }
  if (result.issueNumber || value.issueNumber) {
    lines.push(pair("Issue", `#${String(result.issueNumber ?? value.issueNumber ?? "")}`));
  }
  if (typeof result.title === "string") lines.push(pair("Title", truncate(result.title, 55)));
  if (typeof result.state === "string") lines.push(pair("State", result.state.toUpperCase()));
  if (typeof result.author === "string") lines.push(pair("Author", result.author));
  if (typeof value.output === "string") lines.push(pair("Output", truncate(value.output, 55)));
  return box(theme, "Fuzit · GitHub Issue", lines);
}

function formatInitPlanBox(value: MaybeRecord, theme: Theme): string {
  const changes = Array.isArray(value.changes) ? value.changes : [];
  const lines: string[] = [
    pair("Status", value.applied ? paint(theme, ANSI.green, "APPLIED") : "DRY RUN"),
    pair("Changes", String(changes.length)),
    "",
  ];
  for (const c of (changes as MaybeRecord[]).slice(0, 15)) {
    const action = String(c.action ?? "create").toUpperCase();
    lines.push(`  ${action.padEnd(8)} ${truncate(String(c.path ?? ""), 55)}`);
  }
  return box(theme, "Fuzit · Project Initialization", lines);
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export function formatHumanValue(value: unknown, themeOverrides?: Partial<Theme>): string | null {
  if (!value || (typeof value !== "object" && !Array.isArray(value))) return null;
  const theme = resolveTheme(themeOverrides);

  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      const first = value[0] as MaybeRecord;
      if ("repositoryRevision" in first) {
        return formatSnapshotList(value, theme);
      }
      if ("weights" in first || "expansion" in first || "id" in first) {
        return formatProfileList(value, theme);
      }
    }
    return null;
  }

  const record = value as MaybeRecord;

  // Error envelope (always first)
  if ("error" in record && typeof record.error === "string") {
    return formatError(record, theme);
  }

  // Named kind discriminators (human-only)
  switch (record.kind) {
    case "auth":         return formatAuth(record, theme);
    case "review":       return formatReview(record, theme);
    case "graph-build":  return formatGraphBuild(record, theme);
    case "graph-stats":  return formatGraphStats(record, theme);
    case "pack":         return formatPack(record, theme);
    case "cache-init":
    case "cache-status":
    case "cache-rebuild":
    case "cache-verify":
    case "cache-purge":  return formatCacheResult(String(record.kind), record, theme);
    case "snapshot-created": return formatSnapshotCreate(record, theme);
    case "snapshot-list":    return formatSnapshotList(record.items, theme);
    case "git-status":       return formatGitStatus(record, theme);
    case "git-log":          return formatGitLog(record, theme);
    case "git-diff":         return formatGitDiff(record, theme);
    case "git-blame":        return formatGitBlame(record, theme);
    case "git-file-history": return formatGitLog({ entries: record.entries }, theme);
    case "doctor":           return formatDoctorReport(record as Parameters<typeof formatDoctorReport>[0], theme);
    case "config":           return formatConfig(record, theme);
    case "support":          return formatSupport(record, theme);
    case "profile-list":     return formatProfileList(record.profiles, theme);
    case "context-result":   return formatContextResult(record, theme);
  }

  // Structural fingerprints for objects without kind discriminators
  // (backwards-compatible for shapes emitted before kind was added, keeping JSON pure)
  if ("schemaVersion" in record && "counts" in record && "status" in record) {
    return formatScan(record, theme);
  }
  if ("selected" in record && "redactions" in record) {
    return formatPack(record, theme);
  }
  if ("results" in record && "truncated" in record) {
    return formatGraphQuery(record, theme);
  }
  if ("selectedRoot" in record && "nestedRoots" in record) {
    return formatRepositoryRoots(record, theme);
  }
  if ("values" in record && "provenance" in record) {
    return formatConfig(record, theme);
  }
  if ("productVersion" in record && "checks" in record) {
    return formatSupport(record, theme);
  }
  if ("status" in record && "checks" in record && Array.isArray(record.checks)) {
    return formatDoctorReport(record as Parameters<typeof formatDoctorReport>[0], theme);
  }
  if ("changes" in record && Array.isArray(record.changes) && "applied" in record) {
    return formatInitPlanBox(record, theme);
  }
  if ("changes" in record && Array.isArray(record.changes)) {
    return formatGitStatus(record, theme);
  }
  if ("entries" in record && Array.isArray(record.entries)) {
    return formatGitLog(record, theme);
  }
  if ("files" in record && Array.isArray(record.files)) {
    return formatGitDiff(record, theme);
  }
  if ("lines" in record && Array.isArray(record.lines)) {
    return formatGitBlame(record, theme);
  }
  if ("issueNumber" in record || ("output" in record && "result" in record)) {
    return formatIssueResult(record, theme);
  }
  if ("output" in record && "selected" in record && "report" in record) {
    return formatContextResult(record, theme);
  }
  if ("code-review" in record || "bug-fix" in record) {
    return formatProfileList(record, theme);
  }
  if ("repositoryRevision" in record && "fileFingerprints" in record) {
    return formatSnapshotCreate(record, theme);
  }
  if ("cacheHome" in record && "repositoryFingerprint" in record) {
    return formatCacheResult("cache-status", record, theme);
  }
  if ("path" in record && "decision" in record) {
    return formatCacheResult("cache-rebuild", record, theme);
  }
  if ("path" in record && "valid" in record && "rebuildRequired" in record) {
    return formatCacheResult("cache-verify", record, theme);
  }
  if ("path" in record && "action" in record && typeof record.action === "string" && record.action.includes("purge")) {
    return formatCacheResult("cache-purge", record, theme);
  }
  if ("path" in record && "repositoryId" in record && "state" in record) {
    return formatCacheResult("cache-init", record, theme);
  }

  return null;
}
