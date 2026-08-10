import { createHash } from "node:crypto";

import {
  NORMALIZED_ANALYSIS_SCHEMA_VERSION,
  parseNormalizedAnalysis,
  type AnalysisRelationship,
  type AnalysisSymbol,
  type NormalizedAnalysis,
} from "@fuzit/schemas";

export const PYTHON_PARSER_ADAPTER_VERSION = 1 as const;
export const PYTHON_PARSER_IDENTITY = `python:syntax-adapter@${PYTHON_PARSER_ADAPTER_VERSION}`;
export const PYTHON_PARSER_MAX_SOURCE_BYTES = 4 * 1024 * 1024;

export interface PythonParserInput {
  readonly repositoryId: string;
  readonly path: string;
  readonly contentHash: string;
  readonly source: string;
  readonly knownModules?: Readonly<Record<string, string>>;
}

function stableId(kind: string, value: string): string {
  return `analysis:${kind}:${createHash("sha256").update(value).digest("hex")}`;
}

function moduleName(path: string): string {
  const withoutExtension = path.replace(/\.py$/u, "");
  const withoutInit = withoutExtension.endsWith("/__init__")
    ? withoutExtension.slice(0, -9)
    : withoutExtension;
  return withoutInit.split("/").filter(Boolean).join(".");
}

function syntaxDiagnostics(source: string): string[] {
  const diagnostics: string[] = [];
  const stack: string[] = [];
  const pairs: Readonly<Record<string, string>> = {
    ")": "(",
    "]": "[",
    "}": "{",
  };
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let offset = 0; offset < source.length; offset += 1) {
    const character = source[offset]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote) {
      escaped = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = quote === character ? null : (quote ?? character);
      continue;
    }
    if (quote) continue;
    if (["(", "[", "{"].includes(character)) stack.push(character);
    else if (pairs[character] && stack.pop() !== pairs[character]) {
      diagnostics.push(`PY_SYNTAX: unmatched delimiter at offset ${offset}`);
      break;
    }
  }
  if (quote) diagnostics.push("PY_SYNTAX: unterminated string literal");
  if (stack.length > 0) diagnostics.push("PY_SYNTAX: unclosed delimiter");
  source.split(/\r?\n/u).forEach((line, index) => {
    if (/^(?:def|class)\s+[^:]+$/u.test(line.trim())) {
      diagnostics.push(`PY_SYNTAX: missing suite colon at line ${index + 1}`);
    }
  });
  return diagnostics.slice(0, 128);
}

function pythonRange(line: string, lineIndex: number, offset: number) {
  const startColumn = line.length - line.trimStart().length + 1;
  return {
    start: {
      offset: offset + startColumn - 1,
      line: lineIndex + 1,
      column: startColumn,
    },
    end: {
      offset: offset + line.length,
      line: lineIndex + 1,
      column: line.length + 1,
    },
  };
}

function extractPythonRecords(
  input: PythonParserInput,
  fileId: string,
  analysisIdentity: string,
): { symbols: AnalysisSymbol[]; relationships: AnalysisRelationship[] } {
  const symbols: AnalysisSymbol[] = [];
  const relationships: AnalysisRelationship[] = [];
  const lines = input.source.split(/\r?\n/u);
  let offset = 0;
  let classIndent: number | null = null;
  let decorators: Array<{ line: string; index: number; offset: number }> = [];
  const addSymbol = (
    kind: AnalysisSymbol["kind"],
    name: string,
    line: string,
    lineIndex: number,
    lineOffset: number,
  ) => {
    const range = pythonRange(line, lineIndex, lineOffset);
    symbols.push({
      id: stableId(
        "symbol",
        `${input.repositoryId}\0${input.path}\0${kind}\0${name}\0${range.start.offset}`,
      ),
      repositoryId: input.repositoryId,
      kind,
      name,
      fileId,
      range,
      exported: !name.startsWith("_"),
    });
  };
  const addImport = (
    specifier: string,
    line: string,
    lineIndex: number,
    lineOffset: number,
    dynamic = false,
  ) => {
    const range = pythonRange(line, lineIndex, lineOffset);
    const targetPath = dynamic ? undefined : input.knownModules?.[specifier];
    relationships.push({
      id: stableId(
        "import",
        `${input.repositoryId}\0${input.path}\0${specifier}\0${range.start.offset}`,
      ),
      repositoryId: input.repositoryId,
      kind: "import",
      sourceId: fileId,
      targetId: targetPath
        ? stableId("file", `${input.repositoryId}\0${targetPath}`)
        : null,
      unresolvedTarget: targetPath ? null : specifier,
      provenance: {
        sourceFileId: fileId,
        sourceSymbolId: null,
        range,
        basis: dynamic ? "inferred" : "parsed",
        parserIdentity: PYTHON_PARSER_IDENTITY,
        analysisIdentity,
        confidence: targetPath ? 1 : dynamic ? 0.5 : 0,
        resolution: targetPath ? "resolved" : "unresolved",
      },
    });
  };
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    if (
      classIndent !== null &&
      trimmed &&
      indent <= classIndent &&
      !trimmed.startsWith("@")
    ) {
      classIndent = null;
    }
    if (trimmed.startsWith("@")) {
      decorators.push({ line, index, offset });
      offset += line.length + 1;
      return;
    }
    const classMatch =
      /^(?:class)\s+([\p{L}_][\p{L}\p{N}_]*)(?:\(([^)]*)\))?\s*:/u.exec(
        trimmed,
      );
    const functionMatch =
      /^(?:async\s+)?def\s+([\p{L}_][\p{L}\p{N}_]*)\s*\(/u.exec(trimmed);
    if (classMatch) {
      const name = classMatch[1]!;
      const schema = /(?:Schema$|BaseModel)/u.test(
        `${name} ${classMatch[2] ?? ""}`,
      );
      addSymbol(schema ? "schema" : "class", name, line, index, offset);
      classIndent = indent;
    } else if (functionMatch) {
      const name = functionMatch[1]!;
      addSymbol(
        name.startsWith("test_")
          ? "test"
          : classIndent !== null && indent > classIndent
            ? "method"
            : "function",
        name,
        line,
        index,
        offset,
      );
      for (const decorator of decorators) {
        const route =
          /\.((?:get|post|put|patch|delete))\(\s*["']([^"']+)["']/u.exec(
            decorator.line,
          );
        if (route)
          addSymbol(
            "endpoint",
            `${route[1]!.toUpperCase()} ${route[2]!}`,
            decorator.line,
            decorator.index,
            decorator.offset,
          );
      }
    }
    const importMatch = /^import\s+(.+)$/u.exec(trimmed);
    const fromMatch = /^from\s+([^\s]+)\s+import\s+/u.exec(trimmed);
    if (importMatch) {
      for (const item of importMatch[1]!.split(","))
        addImport(item.trim().split(/\s+as\s+/u)[0]!, line, index, offset);
    } else if (fromMatch) {
      addImport(fromMatch[1]!, line, index, offset);
    }
    const dynamic = /(?:importlib\.import_module|__import__)\(\s*([^)]*)/u.exec(
      trimmed,
    );
    if (dynamic) addImport("<dynamic>", line, index, offset, true);
    decorators = [];
    offset += line.length + 1;
  });
  return {
    symbols: symbols.sort((a, b) => a.id.localeCompare(b.id)),
    relationships: relationships.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export class PythonParserAdapter {
  public readonly adapterVersion = PYTHON_PARSER_ADAPTER_VERSION;
  public readonly parserIdentity = PYTHON_PARSER_IDENTITY;

  public parse(input: PythonParserInput): NormalizedAnalysis {
    const base = {
      schemaVersion: NORMALIZED_ANALYSIS_SCHEMA_VERSION,
      repositoryId: input.repositoryId,
      analysisIdentity: `normalized-analysis@${NORMALIZED_ANALYSIS_SCHEMA_VERSION};${this.parserIdentity}`,
      symbols: [],
      relationships: [],
    } as const;
    if (!input.path.endsWith(".py")) {
      return parseNormalizedAnalysis({
        ...base,
        files: [],
        modules: [],
        completeness: "unsupported",
        diagnostics: ["Unsupported Python source extension"],
      });
    }
    if (
      Buffer.byteLength(input.source, "utf8") > PYTHON_PARSER_MAX_SOURCE_BYTES
    ) {
      return parseNormalizedAnalysis({
        ...base,
        files: [],
        modules: [],
        completeness: "failed",
        diagnostics: [
          `Source exceeds parser limit of ${PYTHON_PARSER_MAX_SOURCE_BYTES} bytes`,
        ],
      });
    }
    const diagnostics = syntaxDiagnostics(input.source);
    const fileId = stableId("file", `${input.repositoryId}\0${input.path}`);
    const name = moduleName(input.path);
    const extracted = extractPythonRecords(
      input,
      fileId,
      base.analysisIdentity,
    );
    return parseNormalizedAnalysis({
      ...base,
      files: [
        {
          id: fileId,
          repositoryId: input.repositoryId,
          kind: "file",
          path: input.path,
          language: "python",
          contentHash: input.contentHash,
        },
      ],
      modules: [
        {
          id: stableId("module", `${input.repositoryId}\0${name}`),
          repositoryId: input.repositoryId,
          kind: input.path.endsWith("/__init__.py") ? "package" : "module",
          name,
          path: input.path,
        },
      ],
      completeness: diagnostics.length > 0 ? "partial" : "complete",
      diagnostics,
      symbols: extracted.symbols,
      relationships: extracted.relationships,
    });
  }
}
