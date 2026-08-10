import { describe, expect, it } from "vitest";

import { TypeScriptParserAdapter } from "@fuzit/analysis";

const adapter = new TypeScriptParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;

function symbols(source: string) {
  return adapter.parse({
    repositoryId,
    contentHash,
    path: "src/symbols.tsx",
    source,
  }).symbols;
}

describe("TypeScript symbol extraction", () => {
  it("extracts declarations, tests, endpoints, schemas, and exact ranges", () => {
    const result = symbols(`
      export function run(): void {}
      export class Service { execute(): void {} }
      interface Contract {}
      type Identifier = string;
      export const UserSchema = z.object({});
      describe("service", () => {});
      router.get("/users", handler);
    `);
    expect(result.map(({ kind, name }) => [kind, name])).toEqual(
      expect.arrayContaining([
        ["function", "run"],
        ["class", "Service"],
        ["method", "execute"],
        ["interface", "Contract"],
        ["type", "Identifier"],
        ["schema", "UserSchema"],
        ["test", "service"],
        ["endpoint", "GET /users"],
      ]),
    );
    expect(
      result.every(
        (symbol) => symbol.range.end.offset >= symbol.range.start.offset,
      ),
    ).toBe(true);
  });

  it("gives overloads and duplicate nested names distinct stable IDs", () => {
    const source = `
      function convert(value: string): string;
      function convert(value: number): number;
      function convert(value: string | number) { return value; }
      function outer() { function convert() {} return convert; }
    `;
    const first = symbols(source).filter(({ name }) => name === "convert");
    const second = symbols(source).filter(({ name }) => name === "convert");
    expect(new Set(first.map(({ id }) => id)).size).toBe(4);
    expect(second.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
  });

  it("names anonymous default declarations deterministically", () => {
    const result = symbols(
      "export default function () {}; export default class {};",
    );
    expect(result.map(({ kind, name }) => [kind, name])).toEqual(
      expect.arrayContaining([
        ["function", "default"],
        ["class", "default"],
      ]),
    );
  });
});
