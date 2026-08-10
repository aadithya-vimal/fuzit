import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { WatcherEvent } from "@fuzit/schemas";

export interface EventVerificationOptions {
  readonly repositoryRoot: string;
  readonly ignorePatterns?: readonly string[] | undefined;
}

export type VerifiedEventOutcome =
  | {
      readonly action: "upsert";
      readonly path: string;
      readonly contentHash: string;
      readonly sizeBytes: number;
      readonly mtimeMs: number;
    }
  | { readonly action: "delete"; readonly path: string }
  | {
      readonly action: "ignore";
      readonly path: string;
      readonly reason: string;
    };

export async function verifyEventAgainstFilesystem(
  event: WatcherEvent,
  options: EventVerificationOptions,
): Promise<VerifiedEventOutcome> {
  const { repositoryRoot, ignorePatterns = [] } = options;
  const targetPath = join(repositoryRoot, event.path);

  // Check ignore patterns
  for (const pattern of ignorePatterns) {
    if (event.path.startsWith(pattern) || event.path.includes(`/${pattern}`)) {
      return {
        action: "ignore",
        path: event.path,
        reason: `Ignored pattern match: ${pattern}`,
      };
    }
  }

  // Check filesystem state
  let fileStat;
  try {
    fileStat = await stat(targetPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { action: "delete", path: event.path };
    }
    return {
      action: "ignore",
      path: event.path,
      reason: "Inaccessible filesystem path",
    };
  }

  if (!fileStat.isFile()) {
    return {
      action: "ignore",
      path: event.path,
      reason: "Target is not a regular file",
    };
  }

  // Compute content hash
  try {
    const buffer = await readFile(targetPath);
    const contentHash = `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
    return {
      action: "upsert",
      path: event.path,
      contentHash,
      sizeBytes: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    };
  } catch {
    return {
      action: "ignore",
      path: event.path,
      reason: "Unable to read file content",
    };
  }
}
