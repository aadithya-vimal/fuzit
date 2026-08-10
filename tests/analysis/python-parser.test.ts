import { describe, expect, it } from "vitest";

import {
  PYTHON_PARSER_IDENTITY,
  PYTHON_PARSER_MAX_SOURCE_BYTES,
  PythonParserAdapter,
} from "@fuzit/analysis";

const adapter = new PythonParserAdapter();
const repositoryId = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;

function parse(path: string, source: string) {
  return adapter.parse({ repositoryId, contentHash, path, source });
}

describe("PythonParserAdapter", () => {
  it("accepts modules, imports, decorators, functions, classes, tests, and routes", () => {
    const result = parse(
      "services/api.py",
      `from .models import User\n@router.get("/users")\ndef test_users():\n    return User\nclass Service:\n    pass\n`,
    );
    expect(result.completeness).toBe("complete");
    expect(result.modules[0]).toMatchObject({
      kind: "module",
      name: "services.api",
    });
    expect(PYTHON_PARSER_IDENTITY).toContain("syntax-adapter@1");
  });

  it("supports regular and namespace package identities deterministically", () => {
    expect(parse("pkg/__init__.py", "").modules[0]).toMatchObject({
      kind: "package",
      name: "pkg",
    });
    expect(parse("namespace/pkg/module.py", "")).toEqual(
      parse("namespace/pkg/module.py", ""),
    );
  });

  it("supports Unicode and relative imports without executing them", () => {
    const result = parse(
      "pkg/module.py",
      "from ..shared import café\nname = 'नमस्ते'\n",
    );
    expect(result.completeness).toBe("complete");
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({
      targetId: null,
      unresolvedTarget: "..shared",
    });
  });

  it("returns bounded partial diagnostics for malformed files", () => {
    const result = parse("broken.py", "def broken(\n");
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics).toEqual([
      "PY_SYNTAX: unclosed delimiter",
      "PY_SYNTAX: missing suite colon at line 1",
    ]);
    expect(result.diagnostics.join(" ")).not.toContain("def broken");
  });

  it("rejects unsupported and oversized files safely", () => {
    expect(parse("module.rb", "puts 1").completeness).toBe("unsupported");
    expect(
      parse("large.py", "x".repeat(PYTHON_PARSER_MAX_SOURCE_BYTES + 1))
        .completeness,
    ).toBe("failed");
  });
});
