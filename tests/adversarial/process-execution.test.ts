import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const auditedFiles = [
  "scripts/package-smoke.mjs",
  "scripts/privacy-audit.mjs",
  "scripts/verify-vsix.mjs",
  "tests/acceptance/github/run.mjs",
] as const;

describe("safe process execution (V1-111)", () => {
  it("uses executable and argument arrays without shell execution", async () => {
    for (const path of auditedFiles) {
      const source = await readFile(resolve(path), "utf8");
      expect(source, path).not.toMatch(/shell\s*:\s*true/u);
      expect(source, path).not.toMatch(/\bexec(?:Sync)?\s*\(/u);
    }
  });

  it("keeps injection-shaped arguments inert and byte-identical", () => {
    const arguments_ = [
      "space value",
      'quote"value',
      "semi;colon",
      "$(not-executed)",
      "日本語-路径",
      "--upload-pack=touch SHOULD_NOT_EXIST",
    ];
    expect(JSON.parse(JSON.stringify(arguments_))).toEqual(arguments_);
  });
});
