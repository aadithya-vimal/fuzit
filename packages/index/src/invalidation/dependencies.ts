export type DependencyRelation = "configuration" | "import" | "test" | "graph";

export type DependencyChangeKind =
  | "exports"
  | "imports"
  | "configuration"
  | "test-dependencies"
  | "graph-edges"
  | "parser-output";

export interface PersistedDependencyRecord {
  readonly path: string;
  readonly dependencies: Readonly<
    Record<DependencyRelation, readonly string[]>
  >;
}

export interface DependencyChange {
  readonly path: string;
  readonly kind: DependencyChangeKind;
  readonly identity: string;
}

export interface DependencyInvalidationReason {
  readonly path: string;
  readonly sourcePath: string;
  readonly kind: DependencyChangeKind | DependencyRelation;
  readonly identity: string;
  readonly reason: string;
}

export interface DependencyInvalidationResult {
  readonly affectedPaths: readonly string[];
  readonly reasons: readonly DependencyInvalidationReason[];
  readonly complete: boolean;
  readonly limit: number;
  readonly diagnostic: string | null;
}

const relationsByChange = {
  exports: ["import", "test", "graph"],
  imports: ["test", "graph"],
  configuration: ["configuration"],
  "test-dependencies": ["test"],
  "graph-edges": ["graph"],
  "parser-output": ["import", "test", "graph"],
} as const satisfies Record<
  DependencyChangeKind,
  readonly DependencyRelation[]
>;

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function assertCanonicalPath(path: string): void {
  if (
    path.length === 0 ||
    path !== path.normalize("NFC") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    /^[A-Za-z]:/u.test(path) ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(
      `Dependency invalidation path must be canonical and repository-relative: ${path}`,
    );
  }
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf8);
}

export function computeDependencyInvalidation(input: {
  readonly records: readonly PersistedDependencyRecord[];
  readonly changes: readonly DependencyChange[];
  readonly maxAffected: number;
}): DependencyInvalidationResult {
  if (!Number.isSafeInteger(input.maxAffected) || input.maxAffected < 1) {
    throw new Error("Dependency invalidation maxAffected must be positive.");
  }

  const records = [...input.records].sort((left, right) =>
    compareUtf8(left.path, right.path),
  );
  const paths = new Set<string>();
  const reverse = new Map<DependencyRelation, Map<string, readonly string[]>>();
  for (const relation of [
    "configuration",
    "import",
    "test",
    "graph",
  ] as const) {
    reverse.set(relation, new Map());
  }

  for (const record of records) {
    assertCanonicalPath(record.path);
    if (paths.has(record.path)) {
      throw new Error(`Duplicate dependency record path: ${record.path}`);
    }
    paths.add(record.path);
    for (const relation of Object.keys(
      record.dependencies,
    ) as DependencyRelation[]) {
      for (const target of sortedUnique(record.dependencies[relation])) {
        assertCanonicalPath(target);
        const index = reverse.get(relation);
        const dependents = index?.get(target) ?? [];
        index?.set(target, sortedUnique([...dependents, record.path]));
      }
    }
  }

  const changes = [...input.changes].sort(
    (left, right) =>
      compareUtf8(left.path, right.path) ||
      compareUtf8(left.kind, right.kind) ||
      compareUtf8(left.identity, right.identity),
  );
  const affected = new Set<string>();
  const reasons: DependencyInvalidationReason[] = [];
  const queue: {
    readonly path: string;
    readonly relations: readonly DependencyRelation[];
    readonly change: DependencyChange;
  }[] = [];
  let truncated = false;

  const add = (
    path: string,
    sourcePath: string,
    kind: DependencyChangeKind | DependencyRelation,
    change: DependencyChange,
    relations: readonly DependencyRelation[],
  ) => {
    if (!paths.has(path) || affected.has(path)) return;
    if (affected.size >= input.maxAffected) {
      truncated = true;
      return;
    }
    affected.add(path);
    reasons.push({
      path,
      sourcePath,
      kind,
      identity: change.identity,
      reason:
        path === change.path
          ? `${change.kind} changed at ${change.path}`
          : `${path} depends on ${sourcePath} through ${kind}`,
    });
    queue.push({ path, relations, change });
  };

  for (const change of changes) {
    assertCanonicalPath(change.path);
    add(
      change.path,
      change.path,
      change.kind,
      change,
      relationsByChange[change.kind],
    );
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const relation of current.relations) {
      for (const dependent of reverse.get(relation)?.get(current.path) ?? []) {
        add(dependent, current.path, relation, current.change, [
          "import",
          "test",
          "graph",
        ]);
      }
    }
  }

  reasons.sort(
    (left, right) =>
      compareUtf8(left.path, right.path) ||
      compareUtf8(left.sourcePath, right.sourcePath) ||
      compareUtf8(left.kind, right.kind),
  );
  const affectedPaths = [...affected].sort(compareUtf8);
  return {
    affectedPaths,
    reasons,
    complete: !truncated,
    limit: input.maxAffected,
    diagnostic: truncated
      ? `Dependency invalidation reached the ${input.maxAffected}-record limit; canonical reconciliation is required.`
      : null,
  };
}
