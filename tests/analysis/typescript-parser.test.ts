import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TYPESCRIPT_PARSER_IDENTITY,
  TYPESCRIPT_PARSER_MAX_SOURCE_BYTES,
  TypeScriptParserAdapter,
} from "@fuzit/analysis";

const adapter = new TypeScriptParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;

async function fixture(name: string): Promise<string> {
  return readFile(resolve("fixtures/analysis/typescript", name), "utf8");
}

function parse(path: string, source: string, tsconfigPath?: string | null) {
  return adapter.parse({
    repositoryId,
    path,
    contentHash,
    source,
    tsconfigPath,
  });
}

describe("TypeScriptParserAdapter", () => {
  it.each([
    ["source.ts", "export const value: number = 1;"],
    ["source.tsx", "export const View = () => <main />;"],
    ["source.js", "module.exports = 1;"],
    ["source.jsx", "export const View = () => <main />;"],
    ["source.mjs", "export default 1;"],
    ["source.cjs", "module.exports = 1;"],
  ])("parses %s without executing repository code", (path, source) => {
    const result = parse(path, source);
    expect(result.completeness).toBe("complete");
    expect(result.files).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("rawAst");
  });

  it("is deterministic without a tsconfig", async () => {
    const source = await fixture("valid.ts");
    expect(parse("src/index.ts", source, null)).toEqual(
      parse("src/index.ts", source),
    );
    expect(TYPESCRIPT_PARSER_IDENTITY).toMatch(/^typescript@/u);
  });

  it("returns bounded safe diagnostics for invalid syntax", async () => {
    const source = await fixture("malformed.ts.txt");
    const result = parse("src/malformed.ts", source);
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics[0]).toMatch(
      /^TS\d+: syntax diagnostic at offset/u,
    );
    expect(result.diagnostics.join(" ")).not.toContain(source);
  });

  it("parses JSX and Unicode fixtures", async () => {
    expect(
      parse("src/component.tsx", await fixture("component.tsx")).completeness,
    ).toBe("complete");
    expect(
      parse("src/unicode.ts", await fixture("unicode.ts")).completeness,
    ).toBe("complete");
  });

  it("rejects unsupported and oversized sources safely", () => {
    expect(parse("src/data.py", "print('x')").completeness).toBe("unsupported");
    const result = parse(
      "src/large.ts",
      "x".repeat(TYPESCRIPT_PARSER_MAX_SOURCE_BYTES + 1),
    );
    expect(result.completeness).toBe("failed");
    expect(result.files).toEqual([]);
  });
});
