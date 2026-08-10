import { describe, expect, it } from "vitest";

import {
  normalizedAnalysisSchema,
  parseNormalizedAnalysis,
  serializeNormalizedAnalysis,
} from "@fuzit/analysis";

const hash = (character: string) => `sha256:${character.repeat(64)}`;
const id = (kind: string, character: string) =>
  `analysis:${kind}:${character.repeat(64)}`;

const repositoryId = hash("a");
const range = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 10, line: 1, column: 11 },
};

function representativeRecord() {
  const fileId = id("file", "b");
  const symbolId = id("symbol", "c");
  return {
    schemaVersion: 1,
    repositoryId,
    analysisIdentity: "normalized-analysis@1",
    files: [
      {
        id: fileId,
        repositoryId,
        kind: "file",
        path: "src/index.ts",
        language: "typescript",
        contentHash: hash("d"),
      },
    ],
    modules: [
      {
        id: id("module", "e"),
        repositoryId,
        kind: "module",
        name: "src/index",
        path: "src/index.ts",
      },
    ],
    symbols: [
      {
        id: symbolId,
        repositoryId,
        kind: "function",
        name: "main",
        fileId,
        range,
        exported: true,
      },
    ],
    relationships: [
      {
        id: id("import", "f"),
        repositoryId,
        kind: "import",
        sourceId: fileId,
        targetId: null,
        unresolvedTarget: "./missing.js",
        provenance: {
          sourceFileId: fileId,
          sourceSymbolId: symbolId,
          range,
          basis: "parsed",
          parserIdentity: "typescript-parser@1",
          analysisIdentity: "normalized-analysis@1",
          confidence: 1,
          resolution: "unresolved",
        },
      },
    ],
    completeness: "partial",
    diagnostics: ["Unresolved import"],
  } as const;
}

describe("normalized analysis contracts", () => {
  it("validates and round-trips representative records without raw ASTs", () => {
    const parsed = parseNormalizedAnalysis(representativeRecord());
    expect(JSON.parse(serializeNormalizedAnalysis(parsed))).toEqual(parsed);
    expect(
      serializeNormalizedAnalysis({
        ...parsed,
        files: [...parsed.files].reverse(),
      }),
    ).toBe(serializeNormalizedAnalysis(parsed));
    expect(
      normalizedAnalysisSchema.safeParse({ ...parsed, rawAst: {} }).success,
    ).toBe(false);
  });

  it("rejects invalid source ranges", () => {
    const record = representativeRecord();
    const invalid = {
      ...record,
      symbols: [
        {
          ...record.symbols[0],
          range: {
            start: { offset: 10, line: 1, column: 11 },
            end: { offset: 1, line: 1, column: 2 },
          },
        },
      ],
    };
    expect(normalizedAnalysisSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects unknown evidence basis labels", () => {
    const record = representativeRecord();
    const invalid = {
      ...record,
      relationships: [
        {
          ...record.relationships[0],
          provenance: { ...record.relationships[0].provenance, basis: "guess" },
        },
      ],
    };
    expect(normalizedAnalysisSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects cross-root identities and non-canonical paths", () => {
    const record = representativeRecord();
    expect(
      normalizedAnalysisSchema.safeParse({
        ...record,
        files: [{ ...record.files[0], repositoryId: hash("9") }],
      }).success,
    ).toBe(false);
    expect(
      normalizedAnalysisSchema.safeParse({
        ...record,
        files: [{ ...record.files[0], path: "../outside.ts" }],
      }).success,
    ).toBe(false);
  });
});
