import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  normalizeRepositoryRelativePath,
  type RepositoryRelativePath,
} from "@fuzit/core";
import { evaluateSensitivePath } from "@fuzit/security";

import {
  loadFuzitignoreRulesForPath,
  loadGitignoreRulesForPath,
} from "../ignore/gitignore.js";
import {
  evaluateIgnorePrecedence,
  type ExplicitPathRule,
} from "../ignore/precedence.js";

export type TraversalEntryKind = "file" | "directory" | "symlink";
export type TraversalErrorCode =
  | "TRAVERSAL.CANCELLED"
  | "TRAVERSAL.PERMISSION_DENIED"
  | "TRAVERSAL.READ_FAILED";

export class TraversalError extends Error {
  readonly code: TraversalErrorCode;

  constructor(code: TraversalErrorCode, message: string) {
    super(message);
    this.name = "TraversalError";
    this.code = code;
  }
}

export interface TraversalDirectoryEntry {
  readonly name: string;
  readonly isDirectory: () => boolean;
  readonly isSymbolicLink: () => boolean;
}

export interface TraversalEntry {
  readonly path: RepositoryRelativePath;
  readonly kind: TraversalEntryKind;
}

export interface TraversalOptions {
  readonly signal?: AbortSignal;
  readonly readDirectory?: (
    path: string,
  ) => Promise<readonly TraversalDirectoryEntry[]>;
  readonly cliRules?: readonly ExplicitPathRule[];
  readonly projectRules?: readonly ExplicitPathRule[];
  readonly onExcluded?: (decision: {
    readonly path: RepositoryRelativePath;
    readonly reason: string;
  }) => void;
}

interface PendingEntry extends TraversalEntry {
  readonly absolutePath: string;
}

function compareNames(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TraversalError(
      "TRAVERSAL.CANCELLED",
      "Directory traversal was cancelled.",
    );
  }
}

async function defaultReadDirectory(
  path: string,
): Promise<readonly TraversalDirectoryEntry[]> {
  return readdir(path, { withFileTypes: true });
}

async function readEntries(
  rootPath: string,
  absolutePath: string,
  relativeDirectory: RepositoryRelativePath,
  options: TraversalOptions,
): Promise<readonly PendingEntry[]> {
  throwIfCancelled(options.signal);

  let entries: readonly TraversalDirectoryEntry[];
  try {
    entries = await (options.readDirectory ?? defaultReadDirectory)(
      absolutePath,
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "EACCES" || error.code === "EPERM")
    ) {
      throw new TraversalError(
        "TRAVERSAL.PERMISSION_DENIED",
        `Permission denied while reading ${relativeDirectory}.`,
      );
    }
    throw new TraversalError(
      "TRAVERSAL.READ_FAILED",
      `Unable to read directory ${relativeDirectory}.`,
    );
  }

  const pendingEntries = [...entries]
    .sort((left, right) => compareNames(left.name, right.name))
    .map((entry) => {
      const path = normalizeRepositoryRelativePath(
        relativeDirectory === "."
          ? entry.name
          : `${relativeDirectory}/${entry.name}`,
      );
      const kind: TraversalEntryKind = entry.isSymbolicLink()
        ? "symlink"
        : entry.isDirectory()
          ? "directory"
          : "file";
      return {
        absolutePath: join(absolutePath, entry.name),
        path,
        kind,
      };
    });
  const included: PendingEntry[] = [];
  for (const entry of pendingEntries) {
    const sensitive = evaluateSensitivePath(entry.path);
    if (sensitive.excluded) {
      options.onExcluded?.({
        path: entry.path,
        reason: sensitive.ruleId ?? sensitive.reason,
      });
      continue;
    }
    const gitignoreRules =
      options.readDirectory === undefined
        ? await loadGitignoreRulesForPath(rootPath, entry.path)
        : [];
    const fuzitignoreRules =
      options.readDirectory === undefined
        ? await loadFuzitignoreRulesForPath(rootPath)
        : [];
    const ignore = evaluateIgnorePrecedence({
      path: entry.path,
      isDirectory: entry.kind === "directory",
      cliRules: options.cliRules ?? [],
      projectRules: options.projectRules ?? [],
      fuzitignoreRules,
      gitignoreRules,
    });
    if (ignore.excluded) {
      options.onExcluded?.({ path: entry.path, reason: ignore.reason });
      continue;
    }
    included.push(entry);
  }
  return included;
}

export async function* traverseDirectory(
  rootPath: string,
  options: TraversalOptions = {},
): AsyncGenerator<TraversalEntry> {
  const pending = [
    ...(await readEntries(
      rootPath,
      rootPath,
      "." as RepositoryRelativePath,
      options,
    )),
  ].reverse();

  while (pending.length > 0) {
    throwIfCancelled(options.signal);
    const entry = pending.pop();
    if (entry === undefined) {
      break;
    }

    yield { path: entry.path, kind: entry.kind };

    if (entry.kind === "directory") {
      const children = await readEntries(
        rootPath,
        entry.absolutePath,
        entry.path,
        options,
      );
      pending.push(...[...children].reverse());
    }
  }
}
