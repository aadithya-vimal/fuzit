import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";

export interface LockMetadata {
  readonly lockVersion: 1;
  readonly pid: number;
  readonly createdAt: string;
  readonly repositoryId: string;
  readonly hostname: string;
  readonly sessionId: string;
}

export interface WriterLockOptions {
  readonly indexPath: string;
  readonly repositoryId: string;
  readonly staleThresholdMs?: number | undefined; // default 30,000ms
}

export class IndexWriterLock {
  private readonly lockFilePath: string;
  private readonly repositoryId: string;
  private readonly staleThresholdMs: number;
  private acquired = false;
  private lockMetadata?: LockMetadata | undefined;

  constructor(options: WriterLockOptions) {
    this.lockFilePath = join(options.indexPath, "writer.lock");
    this.repositoryId = options.repositoryId;
    this.staleThresholdMs = options.staleThresholdMs ?? 30_000;
  }

  public get isHeld(): boolean {
    return this.acquired;
  }

  public get metadata(): LockMetadata | undefined {
    return this.lockMetadata;
  }

  public async acquire(): Promise<void> {
    await mkdir(join(this.lockFilePath, ".."), { recursive: true });

    // Check if existing lock exists
    try {
      const raw = await readFile(this.lockFilePath, "utf8");
      const meta = JSON.parse(raw) as LockMetadata;

      // Validate lock schema
      if (meta.lockVersion !== 1 || typeof meta.pid !== "number") {
        // Corrupt lock file -> purge safely if stale
        await rm(this.lockFilePath, { force: true });
      } else {
        const lockAge = Date.now() - new Date(meta.createdAt).getTime();
        const isSamePid = meta.pid === process.pid;

        if (isSamePid) {
          // Re-acquisition by same process
          this.acquired = true;
          this.lockMetadata = meta;
          return;
        }

        if (lockAge < this.staleThresholdMs) {
          // Check if process is actually running
          let isAlive = false;
          try {
            isAlive = process.kill(meta.pid, 0);
          } catch {
            isAlive = false;
          }

          if (isAlive) {
            throw new Error(
              `Writer lock active and held by PID ${meta.pid} on ${meta.hostname} since ${meta.createdAt}`,
            );
          }
        }

        // Stale lock -> clear stale lock
        await rm(this.lockFilePath, { force: true });
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // File does not exist, proceed to create
      } else if (
        error instanceof Error &&
        error.message.startsWith("Writer lock active")
      ) {
        throw error;
      } else {
        // Corrupt lock file content -> purge safely
        await rm(this.lockFilePath, { force: true });
      }
    }

    const newMeta: LockMetadata = {
      lockVersion: 1,
      pid: process.pid,
      createdAt: new Date().toISOString(),
      repositoryId: this.repositoryId,
      hostname: hostname(),
      sessionId: `session-${process.pid}-${Date.now()}`,
    };

    await writeFile(this.lockFilePath, JSON.stringify(newMeta, null, 2), {
      flag: "wx",
    });
    this.acquired = true;
    this.lockMetadata = newMeta;
  }

  public async release(): Promise<void> {
    if (!this.acquired) return;
    try {
      await rm(this.lockFilePath, { force: true });
    } finally {
      this.acquired = false;
      this.lockMetadata = undefined;
    }
  }
}
