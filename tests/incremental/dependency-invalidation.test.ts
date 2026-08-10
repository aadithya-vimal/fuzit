import { describe, expect, it } from "vitest";

import {
  computeDependencyInvalidation,
  type DependencyRelation,
  type PersistedDependencyRecord,
} from "@fuzit/index";

const none = (): Record<DependencyRelation, string[]> => ({
  configuration: [],
  import: [],
  test: [],
  graph: [],
});

function record(
  path: string,
  dependencies: Partial<Record<DependencyRelation, string[]>> = {},
): PersistedDependencyRecord {
  return { path, dependencies: { ...none(), ...dependencies } };
}

describe("dependency invalidation", () => {
  it("invalidates only a changed export and its justified dependents", () => {
    const result = computeDependencyInvalidation({
      records: [
        record("src/api.ts"),
        record("src/consumer.ts", { import: ["src/api.ts"] }),
        record("test/api.test.ts", { test: ["src/api.ts"] }),
        record("src/unrelated.ts"),
      ],
      changes: [
        {
          path: "src/api.ts",
          kind: "exports",
          identity: "sha256:exports-2",
        },
      ],
      maxAffected: 10,
    });

    expect(result).toMatchObject({
      affectedPaths: ["src/api.ts", "src/consumer.ts", "test/api.test.ts"],
      complete: true,
      diagnostic: null,
    });
    expect(result.reasons).toEqual([
      {
        path: "src/api.ts",
        sourcePath: "src/api.ts",
        kind: "exports",
        identity: "sha256:exports-2",
        reason: "exports changed at src/api.ts",
      },
      {
        path: "src/consumer.ts",
        sourcePath: "src/api.ts",
        kind: "import",
        identity: "sha256:exports-2",
        reason: "src/consumer.ts depends on src/api.ts through import",
      },
      {
        path: "test/api.test.ts",
        sourcePath: "src/api.ts",
        kind: "test",
        identity: "sha256:exports-2",
        reason: "test/api.test.ts depends on src/api.ts through test",
      },
    ]);
  });

  it.each([
    ["imports", "src/importer.ts", "src/graph.ts"],
    ["configuration", "config/tsconfig.json", "src/configured.ts"],
    ["test-dependencies", "src/api.ts", "test/api.test.ts"],
    ["graph-edges", "src/api.ts", "src/graph.ts"],
    ["parser-output", "src/api.ts", "src/importer.ts"],
  ] as const)("handles %s changes", (kind, changedPath, dependentPath) => {
    const relations = {
      import: ["src/api.ts"],
      configuration: ["config/tsconfig.json"],
      test: ["src/api.ts"],
      graph: ["src/api.ts", "src/importer.ts"],
    };
    const result = computeDependencyInvalidation({
      records: [
        record("config/tsconfig.json"),
        record("src/api.ts"),
        record("src/importer.ts", { import: relations.import }),
        record("src/configured.ts", {
          configuration: relations.configuration,
        }),
        record("test/api.test.ts", { test: relations.test }),
        record("src/graph.ts", { graph: relations.graph }),
      ],
      changes: [{ path: changedPath, kind, identity: `identity:${kind}` }],
      maxAffected: 20,
    });

    expect(result.affectedPaths).toContain(changedPath);
    expect(result.affectedPaths).toContain(dependentPath);
  });

  it("terminates cycles and orders paths deterministically", () => {
    const input = {
      records: [
        record("src/b.ts", { import: ["src/a.ts"] }),
        record("src/a.ts", { import: ["src/b.ts"] }),
      ],
      changes: [
        { path: "src/a.ts", kind: "exports" as const, identity: "exports:2" },
      ],
      maxAffected: 10,
    };

    expect(computeDependencyInvalidation(input).affectedPaths).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(computeDependencyInvalidation(input)).toEqual(
      computeDependencyInvalidation({
        ...input,
        records: [...input.records].reverse(),
      }),
    );
  });

  it("reports bounded partial uncertainty for large fan-out", () => {
    const result = computeDependencyInvalidation({
      records: [
        record("src/api.ts"),
        ...Array.from({ length: 20 }, (_, index) =>
          record(`src/consumer-${String(index).padStart(2, "0")}.ts`, {
            import: ["src/api.ts"],
          }),
        ),
      ],
      changes: [
        { path: "src/api.ts", kind: "exports", identity: "exports:2" },
      ],
      maxAffected: 5,
    });

    expect(result.affectedPaths).toHaveLength(5);
    expect(result.complete).toBe(false);
    expect(result.diagnostic).toBe(
      "Dependency invalidation reached the 5-record limit; canonical reconciliation is required.",
    );
  });

  it("matches a clean rebuild when only affected records are rewritten", () => {
    const records = [
      record("src/api.ts"),
      record("src/consumer.ts", { import: ["src/api.ts"] }),
      record("src/unrelated.ts"),
    ];
    const result = computeDependencyInvalidation({
      records,
      changes: [
        { path: "src/api.ts", kind: "exports", identity: "exports:2" },
      ],
      maxAffected: 10,
    });
    const previous = new Map([
      ["src/api.ts", "old-api"],
      ["src/consumer.ts", "old-consumer"],
      ["src/unrelated.ts", "stable"],
    ]);
    const clean = new Map([
      ["src/api.ts", "new-api"],
      ["src/consumer.ts", "new-consumer"],
      ["src/unrelated.ts", "stable"],
    ]);
    for (const path of result.affectedPaths) {
      previous.set(path, clean.get(path) ?? "");
    }

    expect(previous).toEqual(clean);
    expect(result.affectedPaths).not.toContain("src/unrelated.ts");
  });

  it("rejects unsafe paths and invalid resource bounds", () => {
    expect(() =>
      computeDependencyInvalidation({
        records: [record("../outside.ts")],
        changes: [],
        maxAffected: 1,
      }),
    ).toThrow("canonical and repository-relative");
    expect(() =>
      computeDependencyInvalidation({
        records: [],
        changes: [],
        maxAffected: 0,
      }),
    ).toThrow("maxAffected must be positive");
  });
});
