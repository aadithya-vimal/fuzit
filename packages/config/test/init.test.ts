import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  INIT_CONFIG_CONTENT,
  InitConflictError,
  applyInitialization,
  planInitialization,
  type InitFileSystem,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-init-"));
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

describe("safe initialization", () => {
  it("initializes an empty repository with only approved files", async () => {
    const repositoryRoot = await createRepository();
    const input = { repositoryRoot };
    const plan = await planInitialization(input);

    expect(plan.changes.map(({ action, path }) => ({ action, path }))).toEqual([
      { action: "create", path: "fuzit.config.json" },
      { action: "create", path: ".gitignore" },
    ]);

    await applyInitialization(input, plan);

    await expect(
      readFile(join(repositoryRoot, "fuzit.config.json"), "utf8"),
    ).resolves.toBe(INIT_CONFIG_CONTENT);
    await expect(
      readFile(join(repositoryRoot, ".gitignore"), "utf8"),
    ).resolves.toBe(".fuzit/\n.fuzit-index/\n.fuzit/local/\n");
  });

  it("preserves an existing compatible configuration", async () => {
    const repositoryRoot = await createRepository();
    const existing = '{\n  "maxFiles": 20\n}\n';
    await writeFile(join(repositoryRoot, "fuzit.config.json"), existing);

    const input = { repositoryRoot };
    const plan = await planInitialization(input);
    await applyInitialization(input, plan);

    expect(plan.changes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "fuzit.config.json" }),
      ]),
    );
    await expect(
      readFile(join(repositoryRoot, "fuzit.config.json"), "utf8"),
    ).resolves.toBe(existing);
  });

  it("reports a conflicting configuration", async () => {
    const repositoryRoot = await createRepository();
    await writeFile(
      join(repositoryRoot, "fuzit.config.json"),
      '{"unknown":true}\n',
    );

    await expect(planInitialization({ repositoryRoot })).rejects.toBeInstanceOf(
      InitConflictError,
    );
  });

  it("reports a read-only repository without creating files", async () => {
    const repositoryRoot = await createRepository();
    const readOnlyFileSystem: InitFileSystem = {
      readText: async () => undefined,
      createText: async () => {
        const error = new Error("read only");
        Object.assign(error, { code: "EACCES" });
        throw error;
      },
      replaceText: async () => {
        throw new Error("unexpected replace");
      },
      appendText: async () => {
        throw new Error("unexpected append");
      },
    };
    const input = { repositoryRoot, fileSystem: readOnlyFileSystem };
    const plan = await planInitialization(input);

    await expect(applyInitialization(input, plan)).rejects.toMatchObject({
      code: "EACCES",
    });
  });

  it("does not overwrite without the explicit force flag", async () => {
    const repositoryRoot = await createRepository();
    const configPath = join(repositoryRoot, "fuzit.config.json");
    const conflicting = "not json\n";
    await writeFile(configPath, conflicting);

    await expect(planInitialization({ repositoryRoot })).rejects.toBeInstanceOf(
      InitConflictError,
    );
    await expect(readFile(configPath, "utf8")).resolves.toBe(conflicting);

    const input = { repositoryRoot, force: true };
    const plan = await planInitialization(input);
    await applyInitialization(input, plan);
    await expect(readFile(configPath, "utf8")).resolves.toBe(
      INIT_CONFIG_CONTENT,
    );
  });
});
