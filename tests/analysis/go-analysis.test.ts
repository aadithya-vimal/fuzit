import { describe, expect, it } from "vitest";
import { GoAnalysisAdapter } from "@fuzit/analysis";
const adapter = new GoAnalysisAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`,
  contentHash = `sha256:${"b".repeat(64)}`;
const parse = (source: string, path = "pkg/app.go", extra = {}) =>
  adapter.parse({ repositoryId, contentHash, path, source, ...extra });
describe("bounded Go analysis", () => {
  it("extracts packages, aliased imports, functions, methods, and interfaces", () => {
    const r = parse(
      'package app\nimport httpalias "net/http"\ntype Runner interface { Run() }\nfunc Start() {}\nfunc (s Service) Run() {}',
    );
    expect(r.symbols.map((s) => s.kind)).toEqual(
      expect.arrayContaining(["interface", "function", "method"]),
    );
    expect(r.relationships[0]?.unresolvedTarget).toBe("net/http");
  });
  it("extracts tests, main packages, build tags, and HTTP registrations", () => {
    const r = parse(
      '//go:build linux\npackage main\nfunc TestMain(t *testing.T) {}\nfunc init(){ http.HandleFunc("/ready", ready) }',
      "cmd/main_test.go",
    );
    expect(r.modules[0]).toMatchObject({ kind: "module", name: "main" });
    expect(r.symbols.map((s) => s.kind)).toEqual(
      expect.arrayContaining(["test", "endpoint"]),
    );
    expect(r.relationships.some((e) => e.kind === "configuration-link")).toBe(
      true,
    );
  });
  it("records go.mod and replacements deterministically", () => {
    const extra = {
      goMod: "module example.com/app\nreplace old.example/lib => ./local",
    };
    expect(parse("package app", undefined, extra)).toEqual(
      parse("package app", undefined, extra),
    );
  });
  it("returns partial diagnostics for malformed source", () => {
    const r = parse("package app\nfunc broken(){");
    expect(r.completeness).toBe("partial");
    expect(r.diagnostics).toEqual(["GO_SYNTAX: unbalanced braces"]);
  });
});
