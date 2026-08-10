import { describe, expect, it } from "vitest";
import { detectLanguages, detectSourceRoots } from "../src/index.js";

describe("language detection", () => {
  it("handles a mixed repository", () =>
    expect(
      detectLanguages([{ path: "src/a.ts" }, { path: "x.py" }]).map(
        (f) => f.value,
      ),
    ).toEqual(["TypeScript", "Python"]));
  it("detects an extensionless script", () =>
    expect(
      detectLanguages([
        { path: "tool", contentPrefix: "#!/usr/bin/env node" },
      ])[0]?.value,
    ).toBe("JavaScript"));
  it("omits generated files", () =>
    expect(detectLanguages([{ path: "a.ts", generated: true }])).toEqual([]));
  it("omits vendored code", () =>
    expect(detectLanguages([{ path: "vendor/a.go", vendored: true }])).toEqual(
      [],
    ));
  it("does not invent unknown languages", () =>
    expect(detectLanguages([{ path: "README" }])).toEqual([]));
  it("finds likely source and test roots", () =>
    expect(detectSourceRoots(["src/a.ts", "tests/a.ts"])).toEqual([
      "src",
      "tests",
    ]));
});
