import { describe, expect, it } from "vitest";
import {
  TypeScriptParserAdapter,
  enrichCrossLanguageRelations,
} from "@fuzit/analysis";

const parser = new TypeScriptParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;
const base = () =>
  parser.parse({
    repositoryId,
    contentHash,
    path: "src/app.test.ts",
    source:
      "function target() {}\ntest('target', () => {})\nconst UserSchema = z.object({})\n",
  });

describe("cross-language relation enrichment", () => {
  it("links tests, schemas, endpoints, and configuration with provenance", () => {
    const analysis = base();
    const test = analysis.symbols.find(({ kind }) => kind === "test")!;
    const target = analysis.symbols.find(({ name }) => name === "target")!;
    const schema = analysis.symbols.find(({ kind }) => kind === "schema")!;
    const enriched = enrichCrossLanguageRelations(analysis, [
      {
        kind: "test",
        sourceSymbolId: test.id,
        targetId: target.id,
        basis: "parsed",
        originIdentity: "typescript-test-detector@1",
        confidence: 1,
      },
      {
        kind: "schema",
        sourceSymbolId: schema.id,
        targetId: target.id,
        basis: "parsed",
        originIdentity: "zod-detector@1",
        frameworkIdentity: "zod",
        confidence: 0.9,
      },
      {
        kind: "configuration-link",
        sourceSymbolId: target.id,
        targetId: analysis.modules[0]?.id ?? null,
        unresolvedTarget: "package",
        basis: "configured",
        originIdentity: "package-json-detector@1",
        confidence: 1,
      },
    ]);
    expect(enriched.relationships.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["test", "schema", "configuration-link"]),
    );
    expect(
      enriched.relationships.every(
        ({ provenance }) => provenance.parserIdentity.length > 0,
      ),
    ).toBe(true);
  });

  it("marks conflicting evidence ambiguous deterministically", () => {
    const analysis = base();
    const source = analysis.symbols[0]!,
      one = analysis.symbols[1]!;
    const candidates = [
      {
        kind: "test" as const,
        sourceSymbolId: source.id,
        targetId: one.id,
        basis: "inferred" as const,
        originIdentity: "detector-a@1",
        confidence: 0.8,
      },
      {
        kind: "test" as const,
        sourceSymbolId: source.id,
        unresolvedTarget: "other",
        basis: "inferred" as const,
        originIdentity: "detector-b@1",
        confidence: 0.8,
      },
    ];
    const result = enrichCrossLanguageRelations(analysis, candidates);
    expect(result).toEqual(
      enrichCrossLanguageRelations(analysis, [...candidates].reverse()),
    );
    expect(
      result.relationships.every(
        ({ provenance }) => provenance.resolution === "ambiguous",
      ),
    ).toBe(true);
  });

  it("rejects framework-absent lookalikes and unknown identities", () => {
    const analysis = base();
    const source = analysis.symbols[0]!;
    const result = enrichCrossLanguageRelations(analysis, [
      {
        kind: "endpoint",
        sourceSymbolId: source.id,
        unresolvedTarget: "/looks-like-route",
        basis: "inferred",
        originIdentity: "name-detector@1",
        confidence: 0.4,
      },
      {
        kind: "test",
        sourceSymbolId: "analysis:symbol:" + "f".repeat(64),
        unresolvedTarget: "missing",
        basis: "inferred",
        originIdentity: "test-detector@1",
        confidence: 0.4,
      },
    ]);
    expect(result.relationships).toEqual(analysis.relationships);
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics).toHaveLength(2);
  });
});
