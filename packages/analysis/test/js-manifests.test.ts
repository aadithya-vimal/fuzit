import { describe, expect, it } from "vitest";
import {
  detectJavascriptWorkspaceManagers,
  parsePackageJson,
  workspaceDiagnostics,
} from "../src/index.js";

describe("JS manifests", () => {
  it("parses pnpm workspace package facts", () =>
    expect(
      parsePackageJson(
        "package.json",
        '{"name":"x","workspaces":["packages/*"]}',
      ).workspacePatterns,
    ).toEqual(["packages/*"]));
  it("parses npm workspaces", () =>
    expect(
      parsePackageJson("package.json", '{"workspaces":["apps/*"]}')
        .workspacePatterns,
    ).toEqual(["apps/*"]));
  it("diagnoses invalid manifests", () =>
    expect(parsePackageJson("bad", "{").diagnostics).toEqual([
      "invalid package.json",
    ]));
  it("diagnoses duplicate package names", () =>
    expect(
      workspaceDiagnostics([
        parsePackageJson("a", '{"name":"x"}'),
        parsePackageJson("b", '{"name":"x"}'),
      ]),
    ).toEqual(["duplicate package name: x"]));
  it("preserves workspace globs", () =>
    expect(
      parsePackageJson("x", '{"workspaces":["packages/**"]}')
        .workspacePatterns[0],
    ).toBe("packages/**"));
  it("can report lockfile mismatch as caller evidence", () =>
    expect(
      parsePackageJson("x", '{"dependencies":{"a":"1"}}').dependencies,
    ).toEqual(["a"]));
  it("preserves package boundaries, exports, entry points, dependency classes, and scripts as metadata", () => {
    const fact = parsePackageJson(
      "packages/a/package.json",
      JSON.stringify({
        name: "a",
        main: "dist/index.js",
        exports: { ".": "./dist/index.js", "./feature": "./feature.js" },
        scripts: { postinstall: "do-not-run" },
        dependencies: { react: "1" },
        devDependencies: { vitest: "1" },
        peerDependencies: { typescript: "1" },
        optionalDependencies: { fsevents: "1" },
      }),
    );
    expect(fact).toMatchObject({
      packageRoot: "packages/a",
      entryPoints: ["dist/index.js"],
      exports: [".", "./feature"],
      completeness: "complete",
    });
    expect(fact.dependencyClasses).toEqual({
      production: ["react"],
      development: ["vitest"],
      peer: ["typescript"],
      optional: ["fsevents"],
    });
    expect(fact.scripts.postinstall).toBe("do-not-run");
  });
  it("detects npm, pnpm, and Yarn markers with explicit conflict evidence", () => {
    expect(
      detectJavascriptWorkspaceManagers([
        "package-lock.json",
        "pnpm-workspace.yaml",
        "yarn.lock",
      ]),
    ).toEqual({
      managers: ["npm", "pnpm", "yarn"],
      conflicts: ["conflicting workspace managers: npm, pnpm, yarn"],
    });
  });
  it("parses Yarn object-form workspaces deterministically", () => {
    expect(
      parsePackageJson(
        "package.json",
        '{"workspaces":{"packages":["packages/*","apps/*"]}}',
      ).workspacePatterns,
    ).toEqual(["apps/*", "packages/*"]);
  });
});
