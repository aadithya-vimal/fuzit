import { describe, expect, it } from "vitest";
import {
  PARSER_AVAILABILITY_DIAGNOSTICS,
  TypeScriptParserAdapter,
  markUnsupportedFeature,
  runParserSafely,
} from "@fuzit/analysis";

const parser = new TypeScriptParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;
const independent = () =>
  parser.parse({
    repositoryId,
    contentHash,
    path: "src/independent.ts",
    source: "export const manifestFact = true;",
  });

describe("parser availability semantics", () => {
  it("preserves independent facts when an optional parser is absent", async () => {
    const base = independent();
    const result = await runParserSafely({
      parserIdentity: "optional@1",
      timeoutMs: 20,
      independentAnalysis: base,
      parse: null,
    });
    expect(result.files).toEqual(base.files);
    expect(result.symbols).toEqual(base.symbols);
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics).toContain(
      PARSER_AVAILABILITY_DIAGNOSTICS.missing,
    );
  });

  it("contains deliberate parser failures without leaking thrown content", async () => {
    const result = await runParserSafely({
      parserIdentity: "broken@1",
      timeoutMs: 20,
      independentAnalysis: independent(),
      parse: () => {
        throw new Error("SECRET_SOURCE_CONTENT");
      },
    });
    expect(result.diagnostics).toContain(PARSER_AVAILABILITY_DIAGNOSTICS.crash);
    expect(JSON.stringify(result)).not.toContain("SECRET_SOURCE_CONTENT");
  });

  it("bounds parser timeouts deterministically", async () => {
    const result = await runParserSafely({
      parserIdentity: "slow@1",
      timeoutMs: 5,
      independentAnalysis: independent(),
      parse: () => new Promise(() => {}),
    });
    expect(result.diagnostics).toContain(
      PARSER_AVAILABILITY_DIAGNOSTICS.timeout,
    );
  });

  it("standardizes syntax, partial, and unsupported outcomes", async () => {
    const malformed = parser.parse({
      repositoryId,
      contentHash,
      path: "src/broken.ts",
      source: "export const broken = {",
    });
    const result = await runParserSafely({
      parserIdentity: parser.parserIdentity,
      timeoutMs: 20,
      independentAnalysis: independent(),
      parse: () => malformed,
    });
    expect(result.diagnostics).toContain(
      PARSER_AVAILABILITY_DIAGNOSTICS.syntax,
    );
    expect(markUnsupportedFeature(independent()).diagnostics).toContain(
      PARSER_AVAILABILITY_DIAGNOSTICS.unsupported,
    );
  });
});
