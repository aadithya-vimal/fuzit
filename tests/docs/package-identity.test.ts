import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public package identity decision", () => {
  it("matches the deterministic public package topology", async () => {
    const [decision, topologySource] = await Promise.all([
      readFile(resolve(root, "docs/decisions/PACKAGE-IDENTITY.md"), "utf8"),
      readFile(resolve(root, "docs/release/package-topology.json"), "utf8"),
    ]);
    const topology = JSON.parse(topologySource) as {
      publicCandidates: { name: string; bin: string[] }[];
    };
    expect(topology.publicCandidates.map(({ name }) => name)).toEqual([
      "@fuzit/cli",
      "@fuzit/mcp-server",
      "@fuzit/plugin-sdk",
      "fuzit",
    ]);
    for (const candidate of topology.publicCandidates) {
      expect(decision).toContain(`\`${candidate.name}\``);
      for (const binary of candidate.bin)
        expect(decision).toContain(`\`${binary}\``);
    }
  });

  it("records owner-controlled identities and publication authorization", async () => {
    const [decision, stateSource] = await Promise.all([
      readFile(resolve(root, "docs/decisions/PACKAGE-IDENTITY.md"), "utf8"),
      readFile(resolve(root, "docs/release/release-state.json"), "utf8"),
    ]);
    expect(decision).toContain("**Approved 2026-08-09 for preparation.**");
    expect(decision).toContain("npm user `aadithyavimal`");
    expect(JSON.parse(stateSource)).toMatchObject({
      publicationAuthorized: true,
    });
  });
});
