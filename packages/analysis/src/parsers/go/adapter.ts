import { createHash } from "node:crypto";
import {
  NORMALIZED_ANALYSIS_SCHEMA_VERSION,
  parseNormalizedAnalysis,
  type AnalysisRelationship,
  type AnalysisSymbol,
  type NormalizedAnalysis,
} from "@fuzit/schemas";
import { parseGoManifest } from "../../manifests/go/parse.js";

export const GO_ANALYSIS_ADAPTER_VERSION = 1 as const;
export const GO_ANALYSIS_IDENTITY = `go:bounded-adapter@${GO_ANALYSIS_ADAPTER_VERSION}`;
export interface GoAnalysisInput {
  readonly repositoryId: string;
  readonly path: string;
  readonly contentHash: string;
  readonly source: string;
  readonly goMod?: string;
  readonly knownPackages?: Readonly<Record<string, string>>;
}
const id = (kind: string, value: string) =>
  `analysis:${kind}:${createHash("sha256").update(value).digest("hex")}`;

export class GoAnalysisAdapter {
  public readonly adapterVersion = GO_ANALYSIS_ADAPTER_VERSION;
  public readonly parserIdentity = GO_ANALYSIS_IDENTITY;
  public parse(input: GoAnalysisInput): NormalizedAnalysis {
    const analysisIdentity = `normalized-analysis@${NORMALIZED_ANALYSIS_SCHEMA_VERSION};${this.parserIdentity}`;
    if (!input.path.endsWith(".go"))
      return parseNormalizedAnalysis({
        schemaVersion: 1,
        repositoryId: input.repositoryId,
        analysisIdentity,
        files: [],
        modules: [],
        symbols: [],
        relationships: [],
        completeness: "unsupported",
        diagnostics: ["Unsupported Go source extension"],
      });
    const fileId = id("file", `${input.repositoryId}\0${input.path}`);
    const packageName =
      /^\s*package\s+(\w+)/mu.exec(input.source)?.[1] ?? "<unknown>";
    const symbols: AnalysisSymbol[] = [];
    const relationships: AnalysisRelationship[] = [];
    const lines = input.source.split(/\r?\n/u);
    let offset = 0;
    let importBlock = false;
    const location = (line: string, index: number) => ({
      start: { offset, line: index + 1, column: 1 },
      end: {
        offset: offset + line.length,
        line: index + 1,
        column: line.length + 1,
      },
    });
    const symbol = (
      kind: AnalysisSymbol["kind"],
      name: string,
      line: string,
      index: number,
    ) => {
      const range = location(line, index);
      symbols.push({
        id: id(
          "symbol",
          `${input.repositoryId}\0${input.path}\0${kind}\0${name}\0${offset}`,
        ),
        repositoryId: input.repositoryId,
        kind,
        name,
        fileId,
        range,
        exported: /^[A-Z]/u.test(name),
      });
    };
    const relation = (
      kind: AnalysisRelationship["kind"],
      target: string,
      line: string,
      index: number,
      basis: "parsed" | "configured" = "parsed",
    ) => {
      const targetPath = input.knownPackages?.[target];
      const range = location(line, index);
      relationships.push({
        id: id(
          kind,
          `${input.repositoryId}\0${input.path}\0${kind}\0${target}\0${offset}`,
        ),
        repositoryId: input.repositoryId,
        kind,
        sourceId: fileId,
        targetId: targetPath
          ? id("file", `${input.repositoryId}\0${targetPath}`)
          : null,
        unresolvedTarget: targetPath ? null : target,
        provenance: {
          sourceFileId: fileId,
          sourceSymbolId: null,
          range,
          basis,
          parserIdentity: this.parserIdentity,
          analysisIdentity,
          confidence: targetPath ? 1 : 0,
          resolution: targetPath ? "resolved" : "unresolved",
        },
      });
    };
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (/^\/\/(?:go:build| \+build)\s+/u.test(trimmed))
        relation(
          "configuration-link",
          trimmed.replace(/^\/\/\s*/u, ""),
          line,
          index,
          "configured",
        );
      if (/^import\s*\($/u.test(trimmed)) importBlock = true;
      else if (importBlock && trimmed === ")") importBlock = false;
      const imported =
        /^import\s+(?:[\w.]+\s+)?["`]([^"`]+)["`]$/u.exec(trimmed)?.[1] ??
        (importBlock
          ? /^(?:[\w.]+\s+)?["`]([^"`]+)["`]$/u.exec(trimmed)?.[1]
          : undefined);
      if (imported) relation("import", imported, line, index);
      const iface = /^type\s+(\w+)\s+interface\s*\{/u.exec(trimmed);
      if (iface) symbol("interface", iface[1]!, line, index);
      const method = /^func\s*\([^)]+\)\s*(\w+)\s*\(/u.exec(trimmed);
      const fn = /^func\s+(\w+)\s*\(/u.exec(trimmed);
      if (method) symbol("method", method[1]!, line, index);
      else if (fn)
        symbol(
          input.path.endsWith("_test.go") || fn[1]!.startsWith("Test")
            ? "test"
            : "function",
          fn[1]!,
          line,
          index,
        );
      const endpoint =
        /(?:HandleFunc|\.(GET|POST|PUT|PATCH|DELETE))\s*\(\s*["`]([^"`]+)["`]/u.exec(
          trimmed,
        );
      if (endpoint)
        symbol(
          "endpoint",
          `${endpoint[1] ?? "HTTP"} ${endpoint[2]!}`,
          line,
          index,
        );
      offset += line.length + 1;
    });
    if (input.goMod) {
      const manifest = parseGoManifest(input.goMod);
      if (manifest.module)
        relation(
          "configuration-link",
          manifest.module,
          "go.mod",
          0,
          "configured",
        );
      for (const item of [...manifest.replacements].sort((a, b) =>
        a.from.localeCompare(b.from),
      ))
        relation(
          "configuration-link",
          `${item.from}=>${item.to}`,
          "go.mod",
          0,
          "configured",
        );
    }
    const opens = (input.source.match(/\{/gu) ?? []).length,
      closes = (input.source.match(/\}/gu) ?? []).length;
    const diagnostics =
      packageName === "<unknown>"
        ? ["GO_SYNTAX: missing package declaration"]
        : opens === closes
          ? []
          : ["GO_SYNTAX: unbalanced braces"];
    return parseNormalizedAnalysis({
      schemaVersion: 1,
      repositoryId: input.repositoryId,
      analysisIdentity,
      files: [
        {
          id: fileId,
          repositoryId: input.repositoryId,
          kind: "file",
          path: input.path,
          language: "go",
          contentHash: input.contentHash,
        },
      ],
      modules: [
        {
          id: id("module", `${input.repositoryId}\0${packageName}`),
          repositoryId: input.repositoryId,
          kind: packageName === "main" ? "module" : "package",
          name: packageName,
          path: input.path,
        },
      ],
      symbols: symbols.sort((a, b) => a.id.localeCompare(b.id)),
      relationships: relationships.sort((a, b) => a.id.localeCompare(b.id)),
      completeness: diagnostics.length ? "partial" : "complete",
      diagnostics,
    });
  }
}
