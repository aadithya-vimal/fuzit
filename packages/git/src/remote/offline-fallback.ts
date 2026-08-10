/**
 * Offline remote cache fallback manager.
 *
 * Allows previously acquired remote revisions to be reused offline with explicit freshness state.
 *
 * @module
 */

import { existsSync, promises as fs } from "node:fs";
import { join } from "node:path";
import type { RemoteCacheInfo } from "@fuzit/git";

export interface OfflineCacheResult {
  readonly isCached: boolean;
  readonly isStale: boolean;
  readonly lastObservedAt?: string;
  readonly worktreePath?: string;
}

export async function checkOfflineCache(
  info: RemoteCacheInfo,
  _revision: string,
): Promise<OfflineCacheResult> {
  void _revision;
  const metaPath = join(info.cacheDir, "fuzit-cache-meta.json");
  if (!existsSync(metaPath)) {
    return { isCached: false, isStale: true };
  }

  try {
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
    return {
      isCached: true,
      isStale: true, // Offline mode marks cache as stale since network revalidation is bypassed
      lastObservedAt: meta.createdAt,
    };
  } catch {
    return { isCached: false, isStale: true };
  }
}
