import { describe, expect, it } from "vitest";
import { JavaAnalysisAdapter } from "@fuzit/analysis";
const adapter = new JavaAnalysisAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;
const parse = (source: string, extra = {}) =>
  adapter.parse({
    repositoryId,
    contentHash,
    path: "src/App.java",
    source,
    ...extra,
  });

describe("bounded Java analysis", () => {
  it("extracts packages, imports, records, nested classes, methods, and inheritance", () => {
    const result = parse(
      "package app;\nimport api.Base;\npublic record User(String id) {}\nclass App extends Base implements Runnable { class Nested {} public void run() {} }",
    );
    expect(result.modules[0]?.name).toBe("app");
    expect(result.symbols.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["type", "class", "method"]),
    );
    expect(result.relationships.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["import", "inheritance"]),
    );
  });
  it("extracts tests and controller annotations", () => {
    const result = parse(
      'class Api {\n@Test\npublic void testOne() {}\n@GetMapping("/users")\npublic User list() {}\n}',
    );
    expect(result.symbols.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["test", "endpoint"]),
    );
  });
  it("records Maven and Gradle relations deterministically", () => {
    const extra = {
      buildFiles: [
        { path: "pom.xml", source: "<groupId>org.example</groupId>" },
        { path: "build.gradle", source: "implementation 'group:artifact:1'" },
      ],
    };
    expect(parse("class App {}", extra)).toEqual(parse("class App {}", extra));
    expect(
      parse("class App {}", extra).relationships.some(
        ({ kind }) => kind === "configuration-link",
      ),
    ).toBe(true);
  });
  it("returns partial diagnostics for malformed source", () => {
    const result = parse("class Broken {");
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics).toEqual(["JAVA_SYNTAX: unbalanced braces"]);
  });
});
