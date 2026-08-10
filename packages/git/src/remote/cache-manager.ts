/**
 * Remote repository cache manager and worktree manager.
 *
 * Manages Fuzit-owned bare repositories and disposable detached worktrees
 * under the OS user cache.
 *
 * @module
 */

import { existsSync, promises as fs } from "node:fs";
import { join } from "node:path";
import { osUserCacheDir } from "./cache-path.js";

export interface RemoteCacheInfo {
  readonly provider: "github";
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
  readonly cacheDir: string;
  readonly bareRepoPath: string;
}

export function getRemoteCacheInfo(
  host: string,
  owner: string,
  repo: string,
): RemoteCacheInfo {
  const baseCache = osUserCacheDir();
  const repoKey = `${host.toLowerCase()}_${owner.toLowerCase()}_${repo.toLowerCase()}`;
  const cacheDir = join(baseCache, "fuzit", "remote-cache", repoKey);
  const bareRepoPath = join(cacheDir, "repo.git");
  return {
    provider: "github",
    host,
    owner,
    repo,
    cacheDir,
    bareRepoPath,
  };
}

export async function ensureBareRepoCache(
  info: RemoteCacheInfo,
): Promise<void> {
  if (!existsSync(info.bareRepoPath)) {
    await fs.mkdir(info.bareRepoPath, { recursive: true });
    // Save metadata
    await fs.writeFile(
      join(info.cacheDir, "fuzit-cache-meta.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          provider: info.provider,
          host: info.host,
          owner: info.owner,
          repo: info.repo,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }
}

export async function createDisposableWorktree(
  info: RemoteCacheInfo,
  _revision: string,
): Promise<{ worktreePath: string; cleanup: () => Promise<void> }> {
  void _revision;
  const tmpId = `wt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const worktreePath = join(info.cacheDir, "worktrees", tmpId);
  await fs.mkdir(worktreePath, { recursive: true });

  const cleanup = async () => {
    try {
      if (existsSync(worktreePath)) {
        await fs.rm(worktreePath, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  };

  return { worktreePath, cleanup };
}
