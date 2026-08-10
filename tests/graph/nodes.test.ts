import { describe, expect, it } from "vitest";

import {
  createGraphNode,
  createGraphNodeId,
  parseGraphNode,
} from "@fuzit/graph";

const repositoryId = `sha256:${"a".repeat(64)}`;
const repositoryNodeId = createGraphNodeId(repositoryId, "repository", ".");
const provenance = {
  collector: "fixture",
  collectorVersion: "1",
  basis: "observed" as const,
  revision: "fixture-revision",
  sourcePath: null,
  sourceRange: null,
};

describe("graph node contracts", () => {
  it("keeps stable IDs for canonical Unicode identity inputs", () => {
    const decomposed = "docs/cafe\u0301.ts";
    const composed = "docs/caf\u00e9.ts";

    expect(createGraphNodeId(repositoryId, "file", decomposed)).toBe(
      createGraphNodeId(repositoryId, "file", composed),
    );
    expect(
      createGraphNode({
        repositoryId,
        kind: "file",
        identity: decomposed,
        path: composed,
        parentId: repositoryNodeId,
        provenance,
      }).identity,
    ).toBe(composed);
  });

  it("separates otherwise identical nodes across repositories", () => {
    expect(createGraphNodeId(repositoryId, "file", "src/a.ts")).not.toBe(
      createGraphNodeId(`sha256:${"b".repeat(64)}`, "file", "src/a.ts"),
    );
  });

  it("rejects unknown versions and invalid parent contracts", () => {
    const node = createGraphNode({
      repositoryId,
      kind: "file",
      identity: "src/a.ts",
      path: "src/a.ts",
      parentId: repositoryNodeId,
      provenance,
    });

    expect(() => parseGraphNode({ ...node, schemaVersion: 2 })).toThrow();
    expect(() => parseGraphNode({ ...node, parentId: null })).toThrow();
  });
});
