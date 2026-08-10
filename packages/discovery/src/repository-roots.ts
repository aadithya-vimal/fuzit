import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  toRepositoryRelativePath,
  type RepositoryRelativePath,
} from "@fuzit/core";

export type RepositoryRootErrorCode =
  | "DISCOVERY.PATH_MISSING"
  | "DISCOVERY.NOT_DIRECTORY"
  | "DISCOVERY.NOT_REPOSITORY"
  | "DISCOVERY.READ_FAILED";

export class RepositoryRootError extends Error {
  readonly code: RepositoryRootErrorCode;

  constructor(code: RepositoryRootErrorCode, message: string) {
    super(message);
    this.name = "RepositoryRootError";
    this.code = code;
  }
}

export interface ResolveRepositoryRootsInput {
  readonly currentDirectory: string;
  readonly explicitPath?: string;
}

export interface RepositoryRootResolution {
  readonly schemaVersion: 1;
  readonly selectedRoot: string;
  readonly nestedRoots: readonly string[];
  readonly inputWasSymlink: boolean;
}

export interface CanonicalRepositoryRootList {
  readonly schemaVersion: 1;
  readonly selectedRoot: RepositoryRelativePath;
  readonly nestedRoots: readonly RepositoryRelativePath[];
  readonly inputWasSymlink: boolean;
}

export function canonicalizeRepositoryRootList(
  resolution: RepositoryRootResolution,
): CanonicalRepositoryRootList {
  return {
    schemaVersion: 1,
    selectedRoot: toRepositoryRelativePath(
      resolution.selectedRoot,
      resolution.selectedRoot,
    ),
    nestedRoots: resolution.nestedRoots.map((nestedRoot) =>
      toRepositoryRelativePath(resolution.selectedRoot, nestedRoot),
    ),
    inputWasSymlink: resolution.inputWasSymlink,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return false;
    }
    throw new RepositoryRootError(
      "DISCOVERY.READ_FAILED",
      "Unable to inspect repository metadata.",
    );
  }
}

async function isRepositoryRoot(directory: string): Promise<boolean> {
  return pathExists(join(directory, ".git"));
}

async function findContainingRoot(startDirectory: string): Promise<string> {
  let directory = startDirectory;

  while (true) {
    if (await isRepositoryRoot(directory)) {
      return directory;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new RepositoryRootError(
        "DISCOVERY.NOT_REPOSITORY",
        "No Git repository contains the selected path.",
      );
    }
    directory = parent;
  }
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function findNestedRoots(
  selectedRoot: string,
): Promise<readonly string[]> {
  const nestedRoots: string[] = [];
  const pending = [selectedRoot];

  while (pending.length > 0) {
    const directory = pending.pop();
    if (directory === undefined) {
      break;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      throw new RepositoryRootError(
        "DISCOVERY.READ_FAILED",
        "Unable to enumerate repository directories.",
      );
    }

    const childDirectories = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.isSymbolicLink() &&
          entry.name !== ".git",
      )
      .map((entry) => join(directory, entry.name))
      .sort(comparePaths);

    for (const childDirectory of childDirectories) {
      if (await isRepositoryRoot(childDirectory)) {
        nestedRoots.push(childDirectory);
      } else {
        pending.push(childDirectory);
      }
    }
  }

  return nestedRoots.sort(comparePaths);
}

export async function resolveRepositoryRoots(
  input: ResolveRepositoryRootsInput,
): Promise<RepositoryRootResolution> {
  const inputPath = resolve(
    input.currentDirectory,
    input.explicitPath ?? input.currentDirectory,
  );

  let inputMetadata;
  try {
    inputMetadata = await lstat(inputPath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      throw new RepositoryRootError(
        "DISCOVERY.PATH_MISSING",
        "The selected path does not exist.",
      );
    }
    throw new RepositoryRootError(
      "DISCOVERY.READ_FAILED",
      "Unable to inspect the selected path.",
    );
  }

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(inputPath);
  } catch {
    throw new RepositoryRootError(
      "DISCOVERY.PATH_MISSING",
      "The selected path cannot be resolved.",
    );
  }

  const canonicalMetadata = await stat(canonicalPath);
  if (!canonicalMetadata.isDirectory()) {
    throw new RepositoryRootError(
      "DISCOVERY.NOT_DIRECTORY",
      "The selected path is not a directory.",
    );
  }

  const selectedRoot = await findContainingRoot(canonicalPath);
  return {
    schemaVersion: 1,
    selectedRoot,
    nestedRoots: await findNestedRoots(selectedRoot),
    inputWasSymlink: inputMetadata.isSymbolicLink(),
  };
}
