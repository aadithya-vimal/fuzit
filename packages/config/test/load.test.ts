import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigLoadError, loadEffectiveConfig } from "../src/index.js";

const temporaryDirectories: string[] = [];

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-config-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("loadEffectiveConfig", () => {
  it("applies defaults, repository, environment, and CLI precedence", async () => {
    const repositoryRoot = await createRepository();
    await writeFile(
      join(repositoryRoot, "fuzit.config.json"),
      JSON.stringify({
        outputFormat: "text",
        maxFiles: 80,
        diagnosticLevel: "warning",
        include: [],
        exclude: [],
      }),
    );

    const result = await loadEffectiveConfig({
      repositoryRoot,
      environment: {
        FUZIT_OUTPUT_FORMAT: "xml",
        FUZIT_MAX_FILES: "40",
      },
      cli: {
        outputFormat: "json",
      },
    });

    expect(result).toEqual({
      schemaVersion: 1,
      values: {
        outputFormat: "json",
        maxFiles: 40,
        diagnosticLevel: "warning",
        include: [],
        exclude: [],
      },
      provenance: {
        outputFormat: "cli",
        maxFiles: "environment",
        diagnosticLevel: "repository",
        include: "repository",
        exclude: "repository",
      },
    });
  });

  it("rejects unknown repository keys", async () => {
    const repositoryRoot = await createRepository();
    await writeFile(
      join(repositoryRoot, "fuzit.config.json"),
      JSON.stringify({ unexpected: true }),
    );

    await expect(loadEffectiveConfig({ repositoryRoot })).rejects.toMatchObject(
      {
        code: "CONFIG.INVALID",
        issues: [expect.stringContaining("unexpected")],
      },
    );
  });

  it("returns diagnostics for invalid types without exposing values", async () => {
    const repositoryRoot = await createRepository();
    const secretLikeValue = "do-not-echo-this-value";
    await writeFile(
      join(repositoryRoot, "fuzit.config.json"),
      JSON.stringify({ maxFiles: secretLikeValue }),
    );

    let caught: unknown;
    try {
      await loadEffectiveConfig({ repositoryRoot });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigLoadError);
    expect(JSON.stringify(caught)).not.toContain(secretLikeValue);
  });

  it("rejects a configuration path outside the repository", async () => {
    const repositoryRoot = await createRepository();
    const outsidePath = join(repositoryRoot, "..", "fuzit.config.json");

    await expect(
      loadEffectiveConfig({ repositoryRoot, configPath: outsidePath }),
    ).rejects.toMatchObject({
      code: "CONFIG.OUTSIDE_REPOSITORY",
    });
  });

  it("does not execute JavaScript configuration", async () => {
    const repositoryRoot = await createRepository();
    const markerPath = join(repositoryRoot, "executed");
    await writeFile(
      join(repositoryRoot, "fuzit.config.js"),
      `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");`,
    );

    const result = await loadEffectiveConfig({ repositoryRoot });

    expect(result.provenance).toEqual({
      outputFormat: "default",
      maxFiles: "default",
      diagnosticLevel: "default",
      include: "default",
      exclude: "default",
    });
    await expect(
      import("node:fs/promises").then(({ stat }) => stat(markerPath)),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
