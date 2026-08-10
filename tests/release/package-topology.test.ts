import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Candidate = {
  name: string;
  path: string;
  distribution: "npm" | "vsix";
  bin: string[];
  exports: string[];
};

type Topology = {
  publicationAuthorized: boolean;
  npmNameApproval: string;
  publicCandidates: Candidate[];
  bundledInternalPackages: string[];
  privateDevelopmentPackages: string[];
};

const root = resolve(import.meta.dirname, "../..");

async function loadJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(root, path), "utf8")) as Record<
    string,
    unknown
  >;
}

function validateOrdering(values: string[], label: string): void {
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(values) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must use deterministic lexical ordering`);
  }
}

async function validateCandidate(candidate: Candidate): Promise<void> {
  const manifest = await loadJson(`${candidate.path}/package.json`);
  if (manifest.name !== candidate.name) {
    throw new Error(`manifest name mismatch for ${candidate.path}`);
  }
  if (manifest.private !== false) {
    throw new Error(`${candidate.name} must be publishable after approval`);
  }
  const bins = Object.keys((manifest.bin ?? {}) as Record<string, unknown>);
  const exports = Object.keys(
    (manifest.exports ?? {}) as Record<string, unknown>,
  );
  if (JSON.stringify(bins) !== JSON.stringify(candidate.bin)) {
    throw new Error(`bin contract mismatch for ${candidate.name}`);
  }
  if (JSON.stringify(exports) !== JSON.stringify(candidate.exports)) {
    throw new Error(`export contract mismatch for ${candidate.name}`);
  }
}

describe("intended package topology", () => {
  it("matches the exact authorized release manifests", async () => {
    const topology = (await loadJson(
      "docs/release/package-topology.json",
    )) as unknown as Topology;

    expect(topology.publicationAuthorized).toBe(true);
    expect(topology.npmNameApproval).toBe("owner-controlled-and-approved");
    for (const candidate of topology.publicCandidates) {
      await validateCandidate(candidate);
    }
  });

  it("records every package exactly once in deterministic groups", async () => {
    const topology = (await loadJson(
      "docs/release/package-topology.json",
    )) as unknown as Topology;
    const names = [
      ...topology.publicCandidates.map(({ name }) => name),
      ...topology.bundledInternalPackages,
      ...topology.privateDevelopmentPackages,
    ];

    expect(new Set(names).size).toBe(28);
    expect(names).toHaveLength(28);
    validateOrdering(topology.bundledInternalPackages, "bundled packages");
    validateOrdering(topology.privateDevelopmentPackages, "private packages");
  });

  it("fails closed when a declared public contract differs from its manifest", async () => {
    const invalid: Candidate = {
  name: "@fuzit/cli",
  path: "apps/cli",
  distribution: "npm",
  bin: ["not-fuzit"],
  exports: ["."],
};

    await expect(validateCandidate(invalid)).rejects.toThrow(
      "bin contract mismatch for @fuzit/cli",
    );
  });
});
