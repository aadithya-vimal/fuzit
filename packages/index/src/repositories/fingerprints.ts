export interface FileFingerprint {
  readonly path: string;
  readonly size: number;
  readonly modifiedAtMs: number;
  readonly sha256: string;
  readonly acquisitionState: "complete" | "partial" | "unreadable";
}

export interface ScanFingerprintSet {
  readonly scannerVersion: string;
  readonly configHash: string;
  readonly files: readonly FileFingerprint[];
}

export type FingerprintChange = "unchanged" | "modified" | "deleted" | "new";

export function compareFingerprint(
  previous: FileFingerprint | undefined,
  current: FileFingerprint | undefined,
): FingerprintChange {
  if (!previous) return "new";
  if (!current) return "deleted";
  return previous.sha256 === current.sha256 &&
    previous.size === current.size &&
    previous.modifiedAtMs === current.modifiedAtMs
    ? "unchanged"
    : "modified";
}

export function canReuseScan(
  previous: ScanFingerprintSet,
  current: Pick<ScanFingerprintSet, "scannerVersion" | "configHash">,
): boolean {
  return (
    previous.scannerVersion === current.scannerVersion &&
    previous.configHash === current.configHash
  );
}

export function reconcileFingerprints(
  previous: readonly FileFingerprint[],
  current: readonly FileFingerprint[],
): ReadonlyMap<string, FingerprintChange> {
  const before = new Map(previous.map((file) => [file.path, file]));
  const after = new Map(current.map((file) => [file.path, file]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return new Map(
    paths.map((path) => [
      path,
      compareFingerprint(before.get(path), after.get(path)),
    ]),
  );
}

export async function writeFingerprintSet(
  indexDirectory: string,
  value: ScanFingerprintSet,
): Promise<void> {
  const target = join(indexDirectory, "fingerprints.json");
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporary, target);
}

export async function readFingerprintSet(
  indexDirectory: string,
): Promise<ScanFingerprintSet | undefined> {
  try {
    return JSON.parse(
      await readFile(join(indexDirectory, "fingerprints.json"), "utf8"),
    ) as ScanFingerprintSet;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
