import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertArtifactChecksums,
  createArtifactManifest,
} from "../../scripts/artifact-manifest.mjs";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe("release artifact manifest", () => {
  it("records stable ordered paths, checksums, versions, and release matrices", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fuzit-manifest-"));
    temporary.push(directory);
    await writeFile(join(directory, "z.tgz"), "z");
    await writeFile(join(directory, "a.vsix"), "a");
    const output = join(directory, "manifest.json");

    const manifest = await createArtifactManifest({
      artifactDirectory: directory,
      outputPath: output,
    });
    expect(manifest.artifacts.map(({ path }) => path)).toEqual(
      [...manifest.artifacts.map(({ path }) => path)].sort(),
    );
    expect(manifest.lockSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.supportedMatrix.node).toEqual(["24"]);
    expect(manifest.packageVersions.fuzit).toBe("0.0.1");
    expect(JSON.parse(await readFile(output, "utf8"))).toEqual(manifest);
  });

  it("fails after any recorded artifact byte changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fuzit-manifest-"));
    temporary.push(directory);
    const artifact = join(directory, "cli.tgz");
    await writeFile(artifact, "original");
    const manifest = await createArtifactManifest({
      artifactDirectory: directory,
      outputPath: join(directory, "manifest.json"),
    });
    await writeFile(artifact, "modified");
    await expect(assertArtifactChecksums(manifest, directory)).rejects.toThrow(
      "Artifact checksum mismatch",
    );
  });

  it("fails closed for an empty artifact set", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fuzit-manifest-"));
    temporary.push(directory);
    await expect(
      createArtifactManifest({
        artifactDirectory: directory,
        outputPath: join(directory, "manifest.json"),
      }),
    ).rejects.toThrow("No release artifacts");
  });
});
