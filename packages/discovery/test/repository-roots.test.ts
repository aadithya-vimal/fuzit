import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalizeRepositoryRootList,
  RepositoryRootError,
  resolveRepositoryRoots,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function createDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "fuzit-roots-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function markGitRepository(directory: string): Promise<void> {
  await mkdir(join(directory, ".git"));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("repository root resolution", () => {
  it("resolves a Git repository from the current directory", async () => {
    const repository = await createDirectory();
    await markGitRepository(repository);
    const child = join(repository, "src");
    await mkdir(child);

    await expect(
      resolveRepositoryRoots({ currentDirectory: child }),
    ).resolves.toEqual({
      schemaVersion: 1,
      selectedRoot: await import("node:fs/promises").then(({ realpath }) =>
        realpath(repository),
      ),
      nestedRoots: [],
      inputWasSymlink: false,
    });
  });

  it("rejects a non-Git directory with a typed diagnostic", async () => {
    const directory = await createDirectory();

    await expect(
      resolveRepositoryRoots({ currentDirectory: directory }),
    ).rejects.toMatchObject({
      code: "DISCOVERY.NOT_REPOSITORY",
    });
  });

  it("reports nested repositories deterministically", async () => {
    const repository = await createDirectory();
    await markGitRepository(repository);
    const nestedB = join(repository, "packages", "b");
    const nestedA = join(repository, "packages", "a");
    await mkdir(nestedB, { recursive: true });
    await mkdir(nestedA, { recursive: true });
    await markGitRepository(nestedB);
    await markGitRepository(nestedA);

    const result = await resolveRepositoryRoots({
      currentDirectory: repository,
    });

    const expectedNestedRoots = await Promise.all(
      [nestedA, nestedB].map((path) => realpath(path)),
    );

    expect(result.nestedRoots).toEqual(expectedNestedRoots.sort());
    expect(canonicalizeRepositoryRootList(result)).toMatchObject({
      selectedRoot: ".",
      nestedRoots: ["packages/a", "packages/b"],
    });
  });

  it("rejects a missing explicit path with a typed diagnostic", async () => {
    const directory = await createDirectory();

    await expect(
      resolveRepositoryRoots({
        currentDirectory: directory,
        explicitPath: "missing",
      }),
    ).rejects.toBeInstanceOf(RepositoryRootError);
    await expect(
      resolveRepositoryRoots({
        currentDirectory: directory,
        explicitPath: "missing",
      }),
    ).rejects.toMatchObject({
      code: "DISCOVERY.PATH_MISSING",
    });
  });

  it("canonicalizes an explicitly selected symlink path", async () => {
    const container = await createDirectory();
    const repository = join(container, "repository");
    const linkedRepository = join(container, "linked-repository");
    await mkdir(repository);
    await markGitRepository(repository);
    await writeFile(join(repository, "marker.txt"), "not read by discovery\n");
    await symlink(repository, linkedRepository, "junction");

    const result = await resolveRepositoryRoots({
      currentDirectory: container,
      explicitPath: linkedRepository,
    });

    expect(result).toMatchObject({
      selectedRoot: await import("node:fs/promises").then(({ realpath }) =>
        realpath(repository),
      ),
      nestedRoots: [],
      inputWasSymlink: true,
    });
  });
});
