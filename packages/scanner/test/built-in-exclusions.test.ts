import { describe, expect, it } from "vitest";

import { normalizeRepositoryRelativePath } from "@fuzit/core";

import { evaluateBuiltInExclusion } from "../src/index.js";

function decision(path: string, explicitlyIncluded = false) {
  return evaluateBuiltInExclusion(normalizeRepositoryRelativePath(path), {
    explicitlyIncluded,
  });
}

describe("built-in safe exclusions", () => {
  it("excludes node_modules by exact segment", () => {
    expect(decision("packages/cli/node_modules/tool/index.js")).toMatchObject({
      excluded: true,
      rule: { id: "safety.dependencies", hard: true },
    });
  });

  it("excludes Git internals", () => {
    expect(decision(".git/objects/pack/data")).toMatchObject({
      excluded: true,
      rule: { id: "safety.vcs", hard: true },
    });
  });

  it("excludes dist and build outputs", () => {
    expect(decision("packages/cli/dist/index.js")).toMatchObject({
      excluded: true,
      rule: { id: "default.build-output" },
    });
    expect(decision("build/report.txt")).toMatchObject({
      excluded: true,
      rule: { id: "default.build-output" },
    });
  });

  it("excludes Fuzit output and index state", () => {
    expect(decision(".fuzit/index/state.json")).toMatchObject({
      excluded: true,
      rule: { id: "safety.fuzit-state", hard: true },
    });
  });

  it("keeps similarly named legitimate directories", () => {
    expect(decision("node_modules_backup/index.js")).toMatchObject({
      excluded: false,
      rule: null,
    });
    expect(decision("distribution/index.js")).toMatchObject({
      excluded: false,
      rule: null,
    });
    expect(decision("builder/index.js")).toMatchObject({
      excluded: false,
      rule: null,
    });
  });

  it("does not let explicit includes bypass hard safety rules", () => {
    expect(decision(".git/config", true)).toMatchObject({
      excluded: true,
      explicitlyIncluded: true,
      rule: { hard: true },
    });
    expect(decision("dist/output.js", true)).toMatchObject({
      excluded: false,
      explicitlyIncluded: true,
      rule: { hard: false },
    });
  });
});
