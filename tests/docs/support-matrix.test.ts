import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { detectLanguages } from "@fuzit/analysis";

const root = resolve(import.meta.dirname, "../..");
const matrixPath = resolve(root, "docs/reference/support-matrix.md");

describe("public support matrix", () => {
  it("matches runtime and package-manager metadata", async () => {
    const [matrix, packageText, nodeMajor] = await Promise.all([
      readFile(matrixPath, "utf8"),
      readFile(resolve(root, "package.json"), "utf8"),
      readFile(resolve(root, ".nvmrc"), "utf8"),
    ]);
    const metadata = JSON.parse(packageText) as {
      packageManager: string;
      engines: { node: string; pnpm: string };
    };
    expect(nodeMajor.trim()).toBe("24");
    expect(matrix).toContain(`Node \`${metadata.engines.node}\``);
    expect(matrix).toContain(`pnpm \`${metadata.engines.pnpm}\``);
    expect(metadata.packageManager).toBe(`pnpm@${metadata.engines.pnpm}`);
  });

  it("documents every detected language with fixture evidence", async () => {
    const matrix = await readFile(matrixPath, "utf8");
    const languages = detectLanguages([
      { path: "a.ts" },
      { path: "a.js" },
      { path: "a.py" },
      { path: "a.java" },
      { path: "a.go" },
    ]).map(({ value }) => value);
    expect(languages).toEqual([
      "TypeScript",
      "JavaScript",
      "Python",
      "Java",
      "Go",
    ]);
    for (const language of languages) expect(matrix).toContain(language);
    expect(matrix).toContain("Malformed syntax returns safe partial facts");
    expect(matrix).toContain("Raw ASTs are never persisted");
  });

  it("keeps unavailable native evidence visibly community-pending", async () => {
    const matrix = await readFile(matrixPath, "utf8");
    expect(matrix).toContain("Experimental; community validation pending");
    expect(matrix).toContain("community-validation-pending");
    expect(matrix).toContain("not genuine native-Ubuntu release evidence");
    expect(matrix).not.toContain("macOS native verified");
  });
});
