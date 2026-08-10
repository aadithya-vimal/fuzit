import { describe, expect, it } from "vitest";
import { dependencyCycles, extractDependencies } from "../src/index.js";
describe("dependency extraction", () => {
  it("extracts relative imports", () =>
    expect(extractDependencies("a.ts", 'import "./b"')[0]).toMatchObject({
      kind: "relative",
      resolved: true,
    }));
  it("extracts workspace imports", () =>
    expect(extractDependencies("a.ts", 'import "@scope/pkg"')[0]?.kind).toBe(
      "external",
    ));
  it("keeps aliases unresolved", () =>
    expect(extractDependencies("a.ts", 'import "alias/*"')[0]?.resolved).toBe(
      false,
    ));
  it("marks dynamic imports", () =>
    expect(extractDependencies("a.ts", 'import("./b")')[0]?.kind).toBe(
      "dynamic",
    ));
  it("reports deterministic cycles", () =>
    expect(
      dependencyCycles([
        { from: "a.ts", specifier: "./a", kind: "relative", resolved: true },
      ]),
    ).toHaveLength(1));
  it("extracts external dependencies", () =>
    expect(extractDependencies("a.ts", 'import "zod"')[0]?.kind).toBe(
      "external",
    ));
});
