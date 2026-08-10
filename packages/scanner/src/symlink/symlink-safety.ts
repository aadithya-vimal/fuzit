import { lstat, readlink, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  PathNormalizationError,
  toRepositoryRelativePath,
  type RepositoryRelativePath,
} from "@fuzit/core";

export type SymlinkStatus =
  "not-followed" | "followed" | "broken" | "loop" | "outside-root";

export interface SymlinkResolution {
  readonly schemaVersion: 1;
  readonly path: RepositoryRelativePath;
  readonly target: string;
  readonly followed: boolean;
  readonly status: SymlinkStatus;
  readonly targetPath?: RepositoryRelativePath;
}

export async function resolveSymlinkSafely(
  repositoryRoot: string,
  absoluteLinkPath: string,
  path: RepositoryRelativePath,
  options: { readonly follow?: boolean } = {},
): Promise<SymlinkResolution> {
  const metadata = await lstat(absoluteLinkPath);
  if (!metadata.isSymbolicLink())
    throw new Error("Path is not a symbolic link.");
  const target = await readlink(absoluteLinkPath);
  if (!options.follow)
    return {
      schemaVersion: 1,
      path,
      target,
      followed: false,
      status: "not-followed",
    };
  let canonicalTarget: string;
  try {
    canonicalTarget = await realpath(
      resolve(dirname(absoluteLinkPath), target),
    );
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    return {
      schemaVersion: 1,
      path,
      target,
      followed: false,
      status: code === "ELOOP" ? "loop" : "broken",
    };
  }
  try {
    const targetPath = toRepositoryRelativePath(
      await realpath(repositoryRoot),
      canonicalTarget,
    );
    return {
      schemaVersion: 1,
      path,
      target,
      followed: true,
      status: "followed",
      targetPath,
    };
  } catch (error) {
    if (error instanceof PathNormalizationError)
      return {
        schemaVersion: 1,
        path,
        target,
        followed: false,
        status: "outside-root",
      };
    throw error;
  }
}
