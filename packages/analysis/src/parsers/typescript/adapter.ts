import { createHash } from "node:crypto";
import { extname, posix } from "node:path";

import ts from "typescript";

import {
  NORMALIZED_ANALYSIS_SCHEMA_VERSION,
  parseNormalizedAnalysis,
  type AnalysisSymbol,
  type AnalysisRelationship,
  type NormalizedAnalysis,
} from "@fuzit/schemas";

export const TYPESCRIPT_PARSER_ADAPTER_VERSION = 1 as const;
export const TYPESCRIPT_PARSER_IDENTITY = `typescript@${ts.version}:syntax-adapter@${TYPESCRIPT_PARSER_ADAPTER_VERSION}`;
export const TYPESCRIPT_PARSER_MAX_SOURCE_BYTES = 4 * 1024 * 1024;

export interface TypeScriptParserInput {
  readonly repositoryId: string;
  readonly path: string;
  readonly contentHash: string;
  readonly source: string;
  readonly tsconfigPath?: string | null;
  readonly resolution?: TypeScriptModuleResolution;
}

export interface TypeScriptModuleResolution {
  readonly knownFiles: readonly string[];
  readonly pathAliases?: Readonly<Record<string, string>>;
  readonly packageExports?: Readonly<Record<string, string>>;
  readonly projectReferences?: Readonly<Record<string, string>>;
}

const scriptKinds: Readonly<Record<string, ts.ScriptKind>> = {
  ".ts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".js": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
  ".mts": ts.ScriptKind.TS,
  ".cts": ts.ScriptKind.TS,
};

function stableId(kind: string, identity: string): string {
  return `analysis:${kind}:${createHash("sha256").update(identity).digest("hex")}`;
}

function safeDiagnostic(diagnostic: ts.Diagnostic): string {
  return `TS${diagnostic.code}: syntax diagnostic at offset ${diagnostic.start ?? 0}`;
}

function rangeOf(sourceFile: ts.SourceFile, node: ts.Node) {
  const startOffset = node.getStart(sourceFile, false);
  const endOffset = node.getEnd();
  const start = sourceFile.getLineAndCharacterOfPosition(startOffset);
  const end = sourceFile.getLineAndCharacterOfPosition(endOffset);
  return {
    start: {
      offset: startOffset,
      line: start.line + 1,
      column: start.character + 1,
    },
    end: {
      offset: endOffset,
      line: end.line + 1,
      column: end.character + 1,
    },
  };
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts
        .getModifiers(node)
        ?.some(
          (modifier) =>
            modifier.kind === ts.SyntaxKind.ExportKeyword ||
            modifier.kind === ts.SyntaxKind.DefaultKeyword,
        ) ?? false)
    : false;
}

function declarationName(node: ts.NamedDeclaration, fallback: string): string {
  const name = node.name;
  if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
    return name.text;
  }
  return fallback;
}

function extractSymbols(
  sourceFile: ts.SourceFile,
  repositoryId: string,
  path: string,
  fileId: string,
): AnalysisSymbol[] {
  const symbols: AnalysisSymbol[] = [];
  const add = (
    node: ts.Node,
    kind: AnalysisSymbol["kind"],
    name: string,
    exported = false,
  ) => {
    const range = rangeOf(sourceFile, node);
    symbols.push({
      id: stableId(
        "symbol",
        `${repositoryId}\0${path}\0${kind}\0${name}\0${range.start.offset}`,
      ),
      repositoryId,
      kind,
      name,
      fileId,
      range,
      exported,
    });
  };
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) {
      add(
        node,
        "function",
        declarationName(node, "default"),
        hasExportModifier(node),
      );
    } else if (ts.isClassDeclaration(node)) {
      add(
        node,
        "class",
        declarationName(node, "default"),
        hasExportModifier(node),
      );
    } else if (ts.isInterfaceDeclaration(node)) {
      add(node, "interface", node.name.text, hasExportModifier(node));
    } else if (ts.isTypeAliasDeclaration(node)) {
      add(node, "type", node.name.text, hasExportModifier(node));
    } else if (ts.isMethodDeclaration(node)) {
      add(node, "method", declarationName(node, "anonymous"));
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const name = declaration.name.text;
          const isSchema = /Schema$/u.test(name);
          add(
            declaration,
            isSchema ? "schema" : "variable",
            name,
            hasExportModifier(node),
          );
        }
      }
    } else if (ts.isCallExpression(node)) {
      const expressionName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : undefined;
      const firstArgument = node.arguments[0];
      if (
        expressionName &&
        ["describe", "it", "test"].includes(expressionName) &&
        firstArgument &&
        ts.isStringLiteral(firstArgument)
      ) {
        add(node, "test", firstArgument.text);
      } else if (
        expressionName &&
        ["get", "post", "put", "patch", "delete"].includes(expressionName) &&
        firstArgument &&
        ts.isStringLiteral(firstArgument)
      ) {
        add(
          node,
          "endpoint",
          `${expressionName.toUpperCase()} ${firstArgument.text}`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return symbols.sort((left, right) => left.id.localeCompare(right.id));
}

function resolveModulePath(
  sourcePath: string,
  specifier: string,
  resolution: TypeScriptModuleResolution | undefined,
): string | null {
  if (!resolution) return null;
  const known = new Set(resolution.knownFiles);
  let candidate: string | undefined;
  if (specifier.startsWith(".")) {
    candidate = posix.normalize(
      posix.join(posix.dirname(sourcePath), specifier),
    );
    if (
      candidate.startsWith("../") ||
      candidate === ".." ||
      posix.isAbsolute(candidate)
    ) {
      return null;
    }
  } else {
    candidate =
      resolution.packageExports?.[specifier] ??
      resolution.projectReferences?.[specifier];
    if (!candidate) {
      for (const [pattern, target] of Object.entries(
        resolution.pathAliases ?? {},
      ).sort(([left], [right]) => left.localeCompare(right))) {
        if (
          pattern.endsWith("*") &&
          specifier.startsWith(pattern.slice(0, -1))
        ) {
          candidate = target.replace("*", specifier.slice(pattern.length - 1));
          break;
        }
        if (pattern === specifier) candidate = target;
      }
    }
  }
  if (!candidate) return null;
  const candidates = [
    candidate,
    ...[".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].map(
      (extension) => `${candidate}${extension}`,
    ),
    ...["ts", "tsx", "js", "jsx"].map(
      (extension) => `${candidate}/index.${extension}`,
    ),
  ];
  return candidates.find((path) => known.has(path)) ?? null;
}

function extractRelationships(
  sourceFile: ts.SourceFile,
  input: TypeScriptParserInput,
  fileId: string,
  symbols: readonly AnalysisSymbol[],
): AnalysisRelationship[] {
  const relationships: AnalysisRelationship[] = [];
  const add = (
    node: ts.Node,
    kind: "import" | "export",
    specifier: string,
    basis: "parsed" | "inferred",
    forceUnresolved = false,
    explicitTargetId?: string,
  ) => {
    const targetPath = forceUnresolved
      ? null
      : resolveModulePath(input.path, specifier, input.resolution);
    const targetId =
      explicitTargetId ??
      (targetPath
        ? stableId("file", `${input.repositoryId}\0${targetPath}`)
        : null);
    const range = rangeOf(sourceFile, node);
    relationships.push({
      id: stableId(
        kind,
        `${input.repositoryId}\0${input.path}\0${kind}\0${specifier}\0${range.start.offset}`,
      ),
      repositoryId: input.repositoryId,
      kind,
      sourceId: fileId,
      targetId,
      unresolvedTarget: targetId ? null : specifier,
      provenance: {
        sourceFileId: fileId,
        sourceSymbolId: null,
        range,
        basis,
        parserIdentity: TYPESCRIPT_PARSER_IDENTITY,
        analysisIdentity: `normalized-analysis@${NORMALIZED_ANALYSIS_SCHEMA_VERSION}`,
        confidence: targetId ? 1 : basis === "inferred" ? 0.5 : 0,
        resolution: targetId ? "resolved" : "unresolved",
      },
    });
  };
  const visit = (node: ts.Node) => {
    if (
      hasExportModifier(node) &&
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node))
    ) {
      const name = declarationName(node, "default");
      const startOffset = node.getStart(sourceFile, false);
      const target = symbols.find(
        (symbol) =>
          symbol.name === name && symbol.range.start.offset === startOffset,
      );
      add(node, "export", name, "parsed", false, target?.id);
    } else if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const name = declaration.name.text;
          const target = symbols.find(
            (symbol) =>
              symbol.name === name &&
              symbol.range.start.offset ===
                declaration.getStart(sourceFile, false),
          );
          add(declaration, "export", name, "parsed", false, target?.id);
        }
      }
    } else if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node, "import", node.moduleSpecifier.text, "parsed");
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        add(node, "export", node.moduleSpecifier.text, "parsed");
      } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const target = symbols.find(
            ({ name }) =>
              name === element.propertyName?.text || name === element.name.text,
          );
          add(
            element,
            "export",
            element.name.text,
            "parsed",
            false,
            target?.id,
          );
        }
      }
    } else if (ts.isExportAssignment(node)) {
      const target = symbols.find(({ name }) => name === "default");
      add(node, "export", "default", "parsed", false, target?.id);
    } else if (ts.isCallExpression(node)) {
      const first = node.arguments[0];
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        first &&
        ts.isStringLiteral(first)
      ) {
        add(node, "import", first.text, "parsed");
      } else if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        add(
          node,
          "import",
          first && ts.isStringLiteral(first) ? first.text : "<dynamic>",
          "inferred",
          true,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return relationships.sort((left, right) => left.id.localeCompare(right.id));
}

export class TypeScriptParserAdapter {
  public readonly adapterVersion = TYPESCRIPT_PARSER_ADAPTER_VERSION;
  public readonly parserIdentity = TYPESCRIPT_PARSER_IDENTITY;

  public parse(input: TypeScriptParserInput): NormalizedAnalysis {
    const extension = extname(input.path).toLowerCase();
    const scriptKind = scriptKinds[extension];
    const base = {
      schemaVersion: NORMALIZED_ANALYSIS_SCHEMA_VERSION,
      repositoryId: input.repositoryId,
      analysisIdentity: `normalized-analysis@${NORMALIZED_ANALYSIS_SCHEMA_VERSION};${this.parserIdentity}`,
      modules: [],
      symbols: [],
      relationships: [],
    } as const;

    if (scriptKind === undefined) {
      return parseNormalizedAnalysis({
        ...base,
        files: [],
        completeness: "unsupported",
        diagnostics: [`Unsupported source extension: ${extension || "none"}`],
      });
    }

    if (
      Buffer.byteLength(input.source, "utf8") >
      TYPESCRIPT_PARSER_MAX_SOURCE_BYTES
    ) {
      return parseNormalizedAnalysis({
        ...base,
        files: [],
        completeness: "failed",
        diagnostics: [
          `Source exceeds parser limit of ${TYPESCRIPT_PARSER_MAX_SOURCE_BYTES} bytes`,
        ],
      });
    }

    const transpiled = ts.transpileModule(input.source, {
      fileName: input.path,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.Preserve,
        jsx: ts.JsxEmit.Preserve,
      },
    });
    const diagnostics = (transpiled.diagnostics ?? [])
      .slice(0, 128)
      .map(safeDiagnostic);
    const sourceFile = ts.createSourceFile(
      input.path,
      input.source,
      ts.ScriptTarget.Latest,
      false,
      scriptKind,
    );
    const fileId = stableId("file", `${input.repositoryId}\0${input.path}`);
    const symbols = extractSymbols(
      sourceFile,
      input.repositoryId,
      input.path,
      fileId,
    );
    return parseNormalizedAnalysis({
      ...base,
      files: [
        {
          id: fileId,
          repositoryId: input.repositoryId,
          kind: "file",
          path: input.path,
          language:
            scriptKind === ts.ScriptKind.JS || scriptKind === ts.ScriptKind.JSX
              ? "javascript"
              : "typescript",
          contentHash: input.contentHash,
        },
      ],
      symbols,
      relationships: extractRelationships(sourceFile, input, fileId, symbols),
      completeness: diagnostics.length === 0 ? "complete" : "partial",
      diagnostics,
    });
  }
}
