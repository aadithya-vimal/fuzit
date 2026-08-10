import { lstat, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { verifyLocalIndex } from "../verification/verify.js";
import type { IndexSemanticVersions } from "../invalidation/evaluate.js";

export interface CorruptionRecoveryOptions {
  readonly indexPath: string;
  readonly expectedRepositoryId: string;
  readonly currentSemanticState?: IndexSemanticVersions | undefined;
  readonly maxStaleLockAgeMs?: number | undefined; // default 30000 ms (30s)
}

export interface CorruptionRecoveryResult {
  readonly recovered: boolean;
  readonly actionTaken:
    | "none"
    | "cleaned-stale-lock"
    | "cleaned-staging-files"
    | "quarantined-corrupt-index"
    | "rebuilt-index";
  readonly details: string;
  readonly quarantinedPath?: string;
}

export async function recoverCorruptIndex(
  options: CorruptionRecoveryOptions,
): Promise<CorruptionRecoveryResult> {
  const {
    indexPath,
    expectedRepositoryId,
    currentSemanticState,
    maxStaleLockAgeMs = 30000,
  } = options;

  // Verify path confinement: index path must be within safe parent structure and not symlinked outside
  try {
    const lstatResult = await lstat(indexPath);
    if (lstatResult.isSymbolicLink()) {
      return {
        recovered: false,
        actionTaken: "none",
        details:
          "Refusing to operate on symlinked index directory for security",
      };
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        recovered: true,
        actionTaken: "none",
        details: "Index directory absent, no recovery needed",
      };
    }
  }

  // 1. Clean abandoned staging files and temporary files first
  let cleanedStaging = false;
  const transactionsDir = join(indexPath, "transactions");
  try {
    const entries = await readdir(transactionsDir);
    for (const entry of entries) {
      if (entry.endsWith(".staged.json") || entry.endsWith(".tmp")) {
        await rm(join(transactionsDir, entry), { force: true });
        cleanedStaging = true;
      }
    }
  } catch {
    // ignore if transactions dir does not exist
  }

  try {
    const rootEntries = await readdir(indexPath);
    for (const entry of rootEntries) {
      if (entry.endsWith(".tmp")) {
        await rm(join(indexPath, entry), { force: true });
        cleanedStaging = true;
      }
    }
  } catch {
    // ignore
  }

  // 2. Check verification status
  const initialVerification = await verifyLocalIndex({
    indexPath,
    expectedRepositoryId,
    currentSemanticState,
  });

  if (initialVerification.status === "ready") {
    return {
      recovered: true,
      actionTaken: cleanedStaging ? "cleaned-staging-files" : "none",
      details: cleanedStaging
        ? "Cleaned abandoned staging/temporary files; index state restored to ready"
        : "Index is ready and verified intact",
    };
  }

  // Handle stale locks if locked
  if (initialVerification.status === "locked") {
    const lockPath = join(indexPath, "index.lock");
    try {
      const lockStat = await stat(lockPath);
      const ageMs = Date.now() - lockStat.mtimeMs;
      if (ageMs > maxStaleLockAgeMs) {
        await rm(lockPath, { force: true });
        return {
          recovered: true,
          actionTaken: "cleaned-stale-lock",
          details: `Removed stale lock file older than ${maxStaleLockAgeMs}ms`,
        };
      }
    } catch {
      // ignore
    }
  }

  // If index is corrupt, schema-mismatch, repo-mismatch, or incomplete, purge Fuzit-owned index path safely
  if (
    initialVerification.status === "corrupt" ||
    initialVerification.status === "schema-mismatch" ||
    initialVerification.status === "repository-mismatch" ||
    initialVerification.status === "incomplete" ||
    initialVerification.status === "rebuild-required" ||
    initialVerification.status === "stale" ||
    initialVerification.status === "policy-mismatch"
  ) {
    // Enforce path safety: must contain 'fuzit/indexes' in path to prevent deleting unrelated user directories
    const normalized = resolve(indexPath).replace(/\\/g, "/");
    if (!normalized.includes("fuzit/indexes")) {
      return {
        recovered: false,
        actionTaken: "none",
        details:
          "Refusing to purge path that does not match Fuzit index structure",
      };
    }

    await rm(indexPath, { recursive: true, force: true });
    return {
      recovered: true,
      actionTaken: "rebuilt-index",
      details: `Safely purged corrupt/stale index directory (${initialVerification.status}); ready for clean rebuild`,
    };
  }

  return {
    recovered: false,
    actionTaken: "none",
    details: `No recovery action applied for status: ${initialVerification.status}`,
  };
}
