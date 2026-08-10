import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("V1 support policy", () => {
  it("matches package engines and does not overclaim platform evidence", async () => {
    const [policy, manifest, compatibility] = await Promise.all([
      readFile(resolve(root, "docs/release/support-policy.md"), "utf8"),
      readFile(resolve(root, "package.json"), "utf8").then(JSON.parse),
      readFile(resolve(root, "docs/reference/support-matrix.md"), "utf8"),
    ]);
    expect(policy).toContain(`Node.js \`${manifest.engines.node}\``);
    expect(policy).toContain(`pnpm \`${manifest.engines.pnpm}\``);
    expect(policy).toContain("Windows 11 24H2 x64");
    expect(policy).toMatch(
      /target\s+compatibility coordinates, not support claims/,
    );
    expect(compatibility).toContain(
      "not genuine native-Ubuntu release evidence",
    );
    expect(compatibility).toContain("No genuine native macOS validation");
  });

  it("cross-links README and SECURITY and covers every required boundary", async () => {
    const [policy, readme, security] = await Promise.all([
      readFile(resolve(root, "docs/release/support-policy.md"), "utf8"),
      readFile(resolve(root, "README.md"), "utf8"),
      readFile(resolve(root, "SECURITY.md"), "utf8"),
    ]);
    expect(readme).toContain("docs/release/support-policy.md");
    expect(security).toContain("docs/release/support-policy.md");
    for (const heading of [
      "Runtime and operating systems",
      "Supported versions and security",
      "Issue boundary",
      "CLI, MCP, plugin, and extension surfaces",
      "Deprecation and compatibility",
      "Data and privacy expectations",
    ])
      expect(policy).toContain(heading);
  });
});
