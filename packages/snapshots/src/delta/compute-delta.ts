import type { SnapshotManifest } from "@fuzit/schemas";

export interface FileDelta {
  readonly path: string;
  readonly previousPath: string | null;
  readonly kind: "added" | "modified" | "deleted" | "unchanged" | "renamed";
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface SnapshotDelta {
  readonly from: string;
  readonly to: string;
  readonly complete: boolean;
  readonly configChanged: boolean;
  readonly files: readonly FileDelta[];
}

export function computeSnapshotDelta(
  before: SnapshotManifest,
  after: SnapshotManifest,
): SnapshotDelta {
  const oldFiles = new Map(
    before.fileFingerprints.map((file) => [file.path, file]),
  );
  const newFiles = new Map(
    after.fileFingerprints.map((file) => [file.path, file]),
  );
  const deleted = [...oldFiles.values()].filter(
    (file) => !newFiles.has(file.path),
  );
  const added = [...newFiles.values()].filter(
    (file) => !oldFiles.has(file.path),
  );
  const addedByHash = new Map<string, typeof added>();
  for (const file of added) {
    addedByHash.set(file.sha256, [
      ...(addedByHash.get(file.sha256) ?? []),
      file,
    ]);
  }
  const renamedTargets = new Set<string>();
  const files: FileDelta[] = [];

  for (const file of deleted) {
    const candidates = addedByHash.get(file.sha256) ?? [];
    if (candidates.length === 1) {
      const target = candidates[0]!;
      renamedTargets.add(target.path);
      files.push({
        path: target.path,
        previousPath: file.path,
        kind: "renamed",
        confidence: 1,
        evidence: ["identical content hash"],
      });
    } else {
      files.push({
        path: file.path,
        previousPath: file.path,
        kind: "deleted",
        confidence: 1,
        evidence:
          candidates.length > 1
            ? ["rename ambiguous: duplicate content hashes"]
            : ["path absent from target snapshot"],
      });
    }
  }

  for (const file of added) {
    if (!renamedTargets.has(file.path)) {
      files.push({
        path: file.path,
        previousPath: null,
        kind: "added",
        confidence: 1,
        evidence: ["path absent from baseline snapshot"],
      });
    }
  }

  for (const [path, oldFile] of oldFiles) {
    const newFile = newFiles.get(path);
    if (!newFile) continue;
    const unchanged = oldFile.sha256 === newFile.sha256;
    files.push({
      path,
      previousPath: path,
      kind: unchanged ? "unchanged" : "modified",
      confidence: 1,
      evidence: [unchanged ? "identical content hash" : "content hash changed"],
    });
  }

  return {
    from: before.id,
    to: after.id,
    complete: before.complete && after.complete,
    configChanged: before.configHash !== after.configHash,
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}
