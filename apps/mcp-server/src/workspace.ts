import { lstat, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import type { SecurityFilteredItem } from "@fuzit/core";
import type { GraphSnapshot } from "@fuzit/graph";

import {
  assertWithinAllowedRoots,
  canonicalizePath,
  MAX_ALLOWED_ROOTS,
} from "./config.js";

export interface RepositoryAcquisition {
  /** Get security-filtered items for a given root path */
  getItems(root: string): readonly SecurityFilteredItem[];
  /** Get graph snapshot for a given root path */
  getSnapshot(root: string): GraphSnapshot | null;
}

/**
 * Validate and canonicalize workspace allowed roots.
 * - Requires at least one root
 * - Enforces maximum root count
 * - Resolves all roots to canonical absolute paths
 * - Rejects symlinks that point outside the root itself
 */
export async function validateAllowedRoots(
  roots: readonly string[],
): Promise<readonly string[]> {
  if (roots.length === 0)
    throw new RangeError("At least one allowed workspace root is required.");
  if (roots.length > MAX_ALLOWED_ROOTS)
    throw new RangeError(
      `Maximum ${MAX_ALLOWED_ROOTS} allowed workspace roots permitted.`,
    );

  const canonicalized: string[] = [];
  for (const root of roots) {
    if (typeof root !== "string" || root.trim().length === 0)
      throw new TypeError("Each allowed root must be a non-empty string.");

    const abs = canonicalizePath(root);

    // Resolve each root to its current filesystem identity before accepting it.
    try {
      const canonical = resolve(await realpath(abs));
      const stat = await lstat(canonical);
      if (!stat.isDirectory()) {
        throw new RangeError(`Allowed root is not a directory: ${abs}`);
      }
      canonicalized.push(canonical);
    } catch {
      throw new RangeError(`Allowed root does not exist: ${abs}`);
    }
  }
  return [...new Set(canonicalized)].sort((a, b) =>
    Buffer.from(a).compare(Buffer.from(b)),
  );
}

/**
 * Validate that a path is within the allowed roots.
 * Throws if not within any root.
 */
export async function validatePath(
  candidate: string,
  allowedRoots: readonly string[],
): Promise<string> {
  const canonical = resolve(await realpath(canonicalizePath(candidate)));
  return assertWithinAllowedRoots(canonical, allowedRoots);
}

/**
 * Simple in-memory workspace cache.
 * Holds items per root for the lifetime of the server session.
 * Not populated until the first tool call for that root.
 */
export class WorkspaceCache implements RepositoryAcquisition {
  private readonly items = new Map<string, readonly SecurityFilteredItem[]>();
  private readonly snapshots = new Map<string, GraphSnapshot | null>();

  setItems(root: string, items: readonly SecurityFilteredItem[]): void {
    this.items.set(root, items);
  }

  getItems(root: string): readonly SecurityFilteredItem[] {
    return this.items.get(root) ?? [];
  }

  setSnapshot(root: string, snapshot: GraphSnapshot | null): void {
    this.snapshots.set(root, snapshot);
  }

  getSnapshot(root: string): GraphSnapshot | null {
    return this.snapshots.get(root) ?? null;
  }
}
