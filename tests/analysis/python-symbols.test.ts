import { describe, expect, it } from "vitest";
import { PythonParserAdapter } from "@fuzit/analysis";

const adapter = new PythonParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;
const parse = (source: string, path = "pkg/module.py") =>
  adapter.parse({
    repositoryId,
    contentHash,
    path,
    source,
    knownModules: {
      ".models": "pkg/models.py",
      requests: "vendor/requests.py",
    },
  });

describe("Python normalized extraction", () => {
  it("extracts functions, classes, methods, tests, routes, and models", () => {
    const result = parse(`
class User(BaseModel):
    def save(self): pass
@router.get("/users")
def list_users(): pass
def test_users(): pass
`);
    expect(result.symbols.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "schema",
        "method",
        "function",
        "test",
        "endpoint",
      ]),
    );
  });

  it("resolves aliased imports and from-imports including __init__.py", () => {
    const result = parse(
      "import requests as http\nfrom .models import User\n",
      "pkg/__init__.py",
    );
    expect(result.relationships).toHaveLength(2);
    expect(
      result.relationships.every(({ targetId }) => targetId !== null),
    ).toBe(true);
  });

  it("marks dynamic import helpers unresolved and inferred", () => {
    const relation = parse("module = importlib.import_module(name)\n")
      .relationships[0]!;
    expect(relation).toMatchObject({
      targetId: null,
      unresolvedTarget: "<dynamic>",
    });
    expect(relation.provenance.basis).toBe("inferred");
  });

  it("assigns duplicate names distinct deterministic identities", () => {
    const source = "def value(): pass\ndef value(): pass\n";
    const first = parse(source).symbols;
    expect(new Set(first.map(({ id }) => id)).size).toBe(2);
    expect(parse(source).symbols).toEqual(first);
  });
});
