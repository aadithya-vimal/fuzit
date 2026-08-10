export interface DeltaScopeEntry {
  readonly path: string;
  readonly kind: "added" | "modified" | "deleted" | "unchanged" | "renamed";
  readonly previousPath: string | null;
}

export interface DeltaScopeResult<T extends { readonly path: string }> {
  readonly included: readonly T[];
  readonly deleted: readonly { path: string; previousPath: string | null }[];
  readonly excluded: readonly { path: string; reason: string }[];
  readonly baselineComplete: boolean;
}

export function selectDeltaScope<T extends { readonly path: string }>(
  items: readonly T[],
  delta: {
    readonly complete: boolean;
    readonly files: readonly DeltaScopeEntry[];
  },
): DeltaScopeResult<T> {
  const changes = new Map(delta.files.map((file) => [file.path, file]));
  const included = items.filter((item) => {
    const kind = changes.get(item.path)?.kind;
    return kind === "added" || kind === "modified" || kind === "renamed";
  });
  const includedPaths = new Set(included.map((item) => item.path));
  return {
    included,
    deleted: delta.files
      .filter((file) => file.kind === "deleted")
      .map((file) => ({ path: file.path, previousPath: file.previousPath })),
    excluded: items
      .filter((item) => !includedPaths.has(item.path))
      .map((item) => ({
        path: item.path,
        reason: changes.has(item.path)
          ? "unchanged from baseline"
          : "not represented by baseline delta",
      })),
    baselineComplete: delta.complete,
  };
}
