import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertDependencyLicenses,
  generateSbom,
} from "../../scripts/generate-sbom.mjs";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

async function fixture(dependencyLicense: string) {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-sbom-"));
  temporary.push(directory);
  const dependency = join(directory, "node_modules", "dependency");
  await mkdir(dependency, { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name: "@fuzit/private-root",
      version: "1.0.0",
      license: "UNLICENSED",
      dependencies: { dependency: "1.0.0" },
    }),
  );
  await writeFile(
    join(dependency, "package.json"),
    JSON.stringify({
      name: "dependency",
      version: "1.0.0",
      license: dependencyLicense,
    }),
  );
  return join(directory, "package.json");
}

describe("software bill of materials", () => {
  it("records deterministic components, integrity, licenses, and relationships", async () => {
    const manifest = await fixture("MIT");
    const first = await generateSbom({ packageManifestPaths: [manifest] });
    const second = await generateSbom({ packageManifestPaths: [manifest] });
    expect(second).toEqual(first);
    expect(first.components).toHaveLength(2);
    expect(first.components[0]?.integrity).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.relationships).toHaveLength(1);
    expect(first.metadata.tool).toEqual({ name: "fuzit-sbom", version: "1" });
    expect(first.releaseEligible).toBe(false);
    expect(() => assertDependencyLicenses(first)).not.toThrow();
  });

  it("blocks unknown or disallowed dependency licenses", async () => {
    const manifest = await fixture("UNKNOWN");
    const sbom = await generateSbom({ packageManifestPaths: [manifest] });
    expect(() => assertDependencyLicenses(sbom)).toThrow(
      "blocked dependency licenses",
    );
  });
});
