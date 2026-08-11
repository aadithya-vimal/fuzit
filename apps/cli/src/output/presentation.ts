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

function paint(theme: Theme, code: string, value: string): string {
  return theme.color ? `${code}${value}${ANSI.reset}` : value;
}

function icon(theme: Theme, name: "success" | "error" | "warning" | "info" | "next") {
  if (!theme.unicode) {
    return { success: "OK", error: "ERR", warning: "WARN", info: "INFO", next: "->" }[name];
  }
  return { success: "✓", error: "✖", warning: "⚠", info: "ℹ", next: "→" }[name];
}

export function box(theme: Theme, title: string, body: string[]): string {
  const innerWidth = Math.max(
    title.length,
    ...body.map((line) => line.length),
  );
  // Total line width = 1 (border) + 1 (space) + innerWidth + 1 (space) + 1 (border) = innerWidth + 4
  // Fill width = innerWidth + 2 (covers the space + content + space between the border chars)
  const fillWidth = innerWidth + 2;
  const fill = theme.unicode ? "─".repeat(fillWidth) : "-".repeat(fillWidth);
  const top = `${theme.unicode ? "╭" : "+"}${fill}${theme.unicode ? "╮" : "+"}`;
  const bottom = `${theme.unicode ? "╰" : "+"}${fill}${theme.unicode ? "╯" : "+"}`;
  const titleLine = `${theme.unicode ? "│" : "|"} ${paint(theme, ANSI.bold, title.padEnd(innerWidth))} ${theme.unicode ? "│" : "|"}`;
  const padded = body.map((line) => `${theme.unicode ? "│" : "|"} ${line.padEnd(innerWidth)} ${theme.unicode ? "│" : "|"}`);
  return [top, titleLine, ...padded, bottom].join("\n");
}

function pair(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function formatCounts(theme: Theme, counts: MaybeRecord): string[] {
  return [
    pair("Files", String(counts.files ?? 0)),
    pair("Directories", String(counts.directories ?? 0)),
    pair("Symlinks", String(counts.symlinks ?? 0)),
  ];
}

function formatScan(value: MaybeRecord, theme: Theme): string {
  const lines = [
    `${paint(theme, ANSI.blue, icon(theme, "info"))} Fuzit · Repository Scan`,
    "",
    "Repository",
    String(value.root ?? "."),
    "",
    ...formatCounts(theme, (value.counts as MaybeRecord) ?? {}),
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

function formatPack(value: MaybeRecord, theme: Theme): string {
  const redactions = value.redactions as MaybeRecord | undefined;
  const findings = Number(redactions?.findings ?? 0);
  const redactedItems = Number(redactions?.redactedItems ?? 0);
  const omittedItems = Number(redactions?.omittedItems ?? 0);
  const lines = [
    `${paint(theme, ANSI.blue, icon(theme, "info"))} Fuzit · Repository Pack`,
    "",
    pair("Selected files", String((value.selected as unknown[] | undefined)?.length ?? 0)),
    pair("Redaction findings", paint(theme, findings > 0 ? ANSI.yellow : ANSI.green, String(findings))),
    pair("Redacted items", paint(theme, redactedItems > 0 ? ANSI.yellow : ANSI.green, String(redactedItems))),
    pair("Omitted items", paint(theme, omittedItems > 0 ? ANSI.yellow : ANSI.green, String(omittedItems))),
  ];
  if (typeof value.output === "string") lines.push("", pair("Output", value.output));
  return box(theme, "Fuzit · Repository Pack", lines);
}

export function formatGraphStats(value: MaybeRecord, theme: Theme): string {
  const lines = [
    `${paint(theme, ANSI.blue, icon(theme, "info"))} Fuzit · Graph Statistics`,
    "",
    pair("Nodes", String(value.nodes ?? 0)),
    pair("Edges", String(value.edges ?? 0)),
    pair("Completeness", paint(theme, value.completeness === "complete" ? ANSI.green : ANSI.yellow, String(value.completeness ?? "unknown").toUpperCase())),
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

export function formatGraphBuild(value: MaybeRecord, theme: Theme): string {
  return box(theme, "Fuzit · Repository Graph", [
    `${paint(theme, ANSI.blue, icon(theme, "success"))} Graph built`,
    "",
    pair("Nodes", String(value.nodes ?? 0)),
    pair("Edges", String(value.edges ?? 0)),
    pair("Completeness", String(value.completeness ?? "unknown").toUpperCase()),
    "",
    pair("Output", String(value.output ?? "")),
  ]);
}

function formatGraphQuery(value: MaybeRecord, theme: Theme): string {
  const results = Array.isArray(value.results) ? value.results : [];
  const lines = [
    `${paint(theme, ANSI.blue, icon(theme, "info"))} Fuzit · Repository Graph Query`,
    "",
    pair("Results", String(results.length)),
  ];
  if (value.truncated) lines.push(pair("Truncated", paint(theme, ANSI.yellow, "YES")));
  lines.push("", "Results");
  for (const result of results.slice(0, 12)) {
    if (typeof result === "string") {
      lines.push(result);
    } else if (result && typeof result === "object") {
      const record = result as MaybeRecord;
      lines.push(
        `${String(record.kind ?? "node").toUpperCase()}: ${String(record.path ?? record.id ?? "")}`,
      );
    }
  }
  const diagnostics = Array.isArray(value.diagnostics) ? value.diagnostics : [];
  if (diagnostics.length > 0) {
    lines.push("", "Diagnostics");
    for (const diagnostic of diagnostics) lines.push(String(diagnostic));
  }
  return box(theme, "Fuzit · Repository Graph Query", lines);
}

function formatAuth(value: MaybeRecord, theme: Theme): string {
  const lines = [
    `${paint(theme, ANSI.blue, icon(theme, value.status === "Authenticated" || value.status === "Already authenticated" ? "success" : "info"))} Fuzit · GitHub Authentication`,
    "",
    pair(
      "Status",
      paint(
        theme,
        value.status === "Authenticated" || value.status === "Already authenticated"
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
  if (typeof value.error === "string") lines.push("", paint(theme, ANSI.red, value.error));
  if (typeof value.nextStep === "string") lines.push("", `Next: ${value.nextStep}`);
  return box(theme, "Fuzit · GitHub Authentication", lines);
}

function formatReview(value: MaybeRecord, theme: Theme): string {
  const findings = Array.isArray(value.findings) ? value.findings : [];
  const lines = [
    `${paint(theme, ANSI.blue, icon(theme, findings.length > 0 ? "warning" : "success"))} Fuzit · Pull Request Review`,
    "",
    pair("Repository", String(value.repository ?? "")),
    pair("PR", `#${String(value.prNumber ?? "")}`),
  ];
  if (typeof value.summary === "string") {
    lines.push("", "Findings");
    if (findings.length === 0) {
      lines.push(paint(theme, ANSI.green, "✓ No high-confidence findings detected."));
    } else {
      lines.push(paint(theme, ANSI.yellow, `⚠ ${findings.length} finding(s)`));
    }
  }
  if (typeof value.output === "string") lines.push("", pair("Output", value.output));
  return box(theme, "Fuzit · Pull Request Review", lines);
}

function formatError(value: MaybeRecord, theme: Theme): string {
  const message = String(value.error ?? value.message ?? "Unknown error.");
  return box(theme, `${paint(theme, ANSI.red, icon(theme, "error"))} Fuzit Error`, [
    paint(theme, ANSI.red, message),
  ]);
}

export function formatHumanValue(value: unknown, themeOverrides?: Partial<Theme>): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as MaybeRecord;
  const theme = resolveTheme(themeOverrides);

  if ("error" in record && typeof record.error === "string") {
    return formatError(record, theme);
  }
  if (record.kind === "auth") return formatAuth(record, theme);
  if (record.kind === "review") return formatReview(record, theme);
  if ("schemaVersion" in record && "counts" in record && "status" in record) {
    return formatScan(record, theme);
  }
  if (record.kind === "pack" || ("selected" in record && "redactions" in record)) {
    return formatPack(record, theme);
  }
  if (record.kind === "graph-build") {
    return formatGraphBuild(record, theme);
  }
  if (record.kind === "graph-stats") {
    return formatGraphStats(record, theme);
  }
  if ("results" in record && "truncated" in record) return formatGraphQuery(record, theme);
  if ("selectedRoot" in record && "nestedRoots" in record) {
    return box(theme, "Fuzit · Repository Roots", [
      pair("Selected root", String(record.selectedRoot ?? ".")),
      pair("Nested roots", String((record.nestedRoots as unknown[] | undefined)?.length ?? 0)),
    ]);
  }
  return null;
}
