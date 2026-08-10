import { createHash } from "node:crypto";
import {
  NORMALIZED_ANALYSIS_SCHEMA_VERSION,
  parseNormalizedAnalysis,
  type AnalysisRelationship,
  type AnalysisSymbol,
  type NormalizedAnalysis,
} from "@fuzit/schemas";
import { parseJavaManifest } from "../../manifests/java/parse.js";

export const JAVA_ANALYSIS_ADAPTER_VERSION = 1 as const;
export const JAVA_ANALYSIS_IDENTITY = `java:bounded-adapter@${JAVA_ANALYSIS_ADAPTER_VERSION}`;

export interface JavaAnalysisInput {
  readonly repositoryId: string;
  readonly path: string;
  readonly contentHash: string;
  readonly source: string;
  readonly knownTypes?: Readonly<Record<string, string>>;
  readonly buildFiles?: readonly {
    readonly path: string;
    readonly source: string;
  }[];
}

const id = (kind: string, value: string) =>
  `analysis:${kind}:${createHash("sha256").update(value).digest("hex")}`;

export class JavaAnalysisAdapter {
  public readonly adapterVersion = JAVA_ANALYSIS_ADAPTER_VERSION;
  public readonly parserIdentity = JAVA_ANALYSIS_IDENTITY;

  public parse(input: JavaAnalysisInput): NormalizedAnalysis {
    const analysisIdentity = `normalized-analysis@${NORMALIZED_ANALYSIS_SCHEMA_VERSION};${this.parserIdentity}`;
    if (!input.path.endsWith(".java"))
      return parseNormalizedAnalysis({
        schemaVersion: 1,
        repositoryId: input.repositoryId,
        analysisIdentity,
        files: [],
        modules: [],
        symbols: [],
        relationships: [],
        completeness: "unsupported",
        diagnostics: ["Unsupported Java source extension"],
      });
    const fileId = id("file", `${input.repositoryId}\0${input.path}`);
    const packageName =
      /\bpackage\s+([\w.]+)\s*;/u.exec(input.source)?.[1] ?? "<default>";
    const symbols: AnalysisSymbol[] = [];
    const relationships: AnalysisRelationship[] = [];
    const lines = input.source.split(/\r?\n/u);
    let offset = 0;
    let annotation = "";
    const range = (line: string, index: number, at: number) => ({
      start: { offset: at, line: index + 1, column: 1 },
      end: {
        offset: at + line.length,
        line: index + 1,
        column: line.length + 1,
      },
    });
    const addSymbol = (
      kind: AnalysisSymbol["kind"],
      name: string,
      line: string,
      index: number,
    ) => {
      const location = range(line, index, offset);
      symbols.push({
        id: id(
          "symbol",
          `${input.repositoryId}\0${input.path}\0${kind}\0${name}\0${offset}`,
        ),
        repositoryId: input.repositoryId,
        kind,
        name,
        fileId,
        range: location,
        exported: /\bpublic\b/u.test(line),
      });
      return symbols.at(-1)!;
    };
    const addRelation = (
      kind: AnalysisRelationship["kind"],
      target: string,
      line: string,
      index: number,
      basis: "parsed" | "configured" = "parsed",
      sourceSymbolId: string | null = null,
    ) => {
      const targetPath = input.knownTypes?.[target];
      const location = range(line, index, offset);
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
          sourceSymbolId,
          range: location,
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
      if (trimmed.startsWith("@")) annotation = trimmed;
      const imported = /^import\s+(?:static\s+)?([\w.*]+)\s*;/u.exec(
        trimmed,
      )?.[1];
      if (imported) addRelation("import", imported, line, index);
      const declaration =
        /\b(class|interface|record)\s+(\w+)(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([\w., ]+))?/u.exec(
          trimmed,
        );
      if (declaration) {
        const symbol = addSymbol(
          declaration[1] === "interface"
            ? "interface"
            : declaration[1] === "record"
              ? "type"
              : "class",
          declaration[2]!,
          line,
          index,
        );
        for (const target of [
          declaration[3],
          ...(declaration[4]?.split(",").map((v) => v.trim()) ?? []),
        ].filter(Boolean) as string[])
          addRelation("inheritance", target, line, index, "parsed", symbol.id);
      }
      const method =
        /(?:public|protected|private|static|final|synchronized|\s)+[\w<>,?[\].]+\s+(\w+)\s*\([^;]*\)\s*(?:\{|throws)/u.exec(
          trimmed,
        );
      if (method) {
        addSymbol(
          annotation.includes("@Test") || method[1]!.startsWith("test")
            ? "test"
            : "method",
          method[1]!,
          line,
          index,
        );
        const route =
          /@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*["']([^"']+)/u.exec(
            annotation,
          );
        if (route)
          addSymbol(
            "endpoint",
            `${route[1]!.toUpperCase()} ${route[2]!}`,
            line,
            index,
          );
        annotation = "";
      }
      offset += line.length + 1;
    });
    for (const build of [...(input.buildFiles ?? [])].sort((a, b) =>
      a.path.localeCompare(b.path),
    )) {
      for (const dependency of parseJavaManifest(
        build.source,
      ).dependencies.sort())
        addRelation(
          "configuration-link",
          dependency,
          build.path,
          0,
          "configured",
        );
    }
    const opens = (input.source.match(/\{/gu) ?? []).length;
    const closes = (input.source.match(/\}/gu) ?? []).length;
    const diagnostics =
      opens === closes ? [] : ["JAVA_SYNTAX: unbalanced braces"];
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
          language: "java",
          contentHash: input.contentHash,
        },
      ],
      modules: [
        {
          id: id("module", `${input.repositoryId}\0${packageName}`),
          repositoryId: input.repositoryId,
          kind: "package",
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
