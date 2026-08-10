import { describe, expect, it } from "vitest";

import { TypeScriptParserAdapter } from "@fuzit/analysis";

const adapter = new TypeScriptParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;
const resolution = {
  knownFiles: [
    "src/local.ts",
    "src/shared/util.ts",
    "packages/lib/src/index.ts",
    "packages/ref/src/index.ts",
  ],
  pathAliases: { "@shared/*": "src/shared/*" },
  packageExports: { "@scope/lib": "packages/lib/src/index.ts" },
  projectReferences: { ref: "packages/ref/src/index.ts" },
};

function parse(source: string) {
  return adapter.parse({
    repositoryId,
    contentHash,
    path: "src/index.ts",
    source,
    resolution,
  });
}

describe("TypeScript module relationships", () => {
  it("resolves ESM, aliases, monorepo packages, and project references", () => {
    const result = parse(`
      import "./local";
      import util from "@shared/util";
      export * from "@scope/lib";
      import "ref";
    `);
    expect(result.relationships).toHaveLength(4);
    expect(
      result.relationships.every(({ targetId }) => targetId !== null),
    ).toBe(true);
    expect(
      result.relationships.every(
        ({ provenance }) => provenance.basis === "parsed",
      ),
    ).toBe(true);
  });

  it("resolves CommonJS and preserves deterministic relationship IDs", () => {
    const source = `const local = require("./local");`;
    expect(parse(source).relationships).toEqual(parse(source).relationships);
    expect(parse(source).relationships[0]?.targetId).not.toBeNull();
  });

  it("keeps dynamic and missing targets explicitly unresolved", () => {
    const result = parse(`
      import("./local");
      import(name);
      import "./missing";
    `);
    expect(result.relationships).toHaveLength(3);
    expect(
      result.relationships.every(({ targetId }) => targetId === null),
    ).toBe(true);
    expect(
      result.relationships.map(({ unresolvedTarget }) => unresolvedTarget),
    ).toEqual(expect.arrayContaining(["./local", "<dynamic>", "./missing"]));
  });

  it("records named and default exports against extracted symbols", () => {
    const result = parse(`
      const value = 1;
      export { value };
      export default function () {}
    `);
    const exports = result.relationships.filter(
      ({ kind }) => kind === "export",
    );
    expect(exports).toHaveLength(2);
    expect(exports.every(({ targetId }) => targetId !== null)).toBe(true);
  });
});
