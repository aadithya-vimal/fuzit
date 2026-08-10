export const JAVASCRIPT_WORKSPACE_DETECTOR_VERSION = "1" as const;

export type DependencyClass =
  "production" | "development" | "peer" | "optional";

export interface JsPackageFact {
  readonly name: string;
  readonly path: string;
  readonly packageRoot: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: readonly string[];
  readonly dependencyClasses: Readonly<
    Record<DependencyClass, readonly string[]>
  >;
  readonly workspacePatterns: readonly string[];
  readonly entryPoints: readonly string[];
  readonly exports: readonly string[];
  readonly detector: "javascript-workspace";
  readonly detectorVersion: "1";
  readonly completeness: "complete" | "partial";
  readonly diagnostics: readonly string[];
}

const canonical = (path: string) =>
  path.replaceAll("\\", "/").replace(/^\.\//, "");
const stringRecord = (value: unknown): Record<string, string> =>
  typeof value === "object" && value !== null
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};
const sortedKeys = (value: unknown) => Object.keys(stringRecord(value)).sort();
const exportKeys = (value: unknown): string[] => {
  if (typeof value === "string") return ["."];
  if (typeof value !== "object" || value === null) return [];
  return Object.keys(value).sort();
};

export function parsePackageJson(path: string, source: string): JsPackageFact {
  const normalizedPath = canonical(path);
  const packageRoot = normalizedPath.includes("/")
    ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
    : ".";
  try {
    const value = JSON.parse(source) as Record<string, unknown>;
    const workspaceValue = Array.isArray(value.workspaces)
      ? value.workspaces
      : typeof value.workspaces === "object" &&
          value.workspaces !== null &&
          Array.isArray((value.workspaces as { packages?: unknown }).packages)
        ? (value.workspaces as { packages: unknown[] }).packages
        : [];
    const dependencyClasses = {
      production: sortedKeys(value.dependencies),
      development: sortedKeys(value.devDependencies),
      peer: sortedKeys(value.peerDependencies),
      optional: sortedKeys(value.optionalDependencies),
    } satisfies Record<DependencyClass, string[]>;
    const entryPoints = [value.main, value.module, value.browser, value.bin]
      .flatMap((item) =>
        typeof item === "string" ? [item] : Object.values(stringRecord(item)),
      )
      .map(canonical)
      .sort();
    return {
      name: typeof value.name === "string" ? value.name : normalizedPath,
      path: normalizedPath,
      packageRoot,
      scripts: Object.fromEntries(
        Object.entries(stringRecord(value.scripts)).sort(),
      ),
      dependencies: [
        ...new Set(Object.values(dependencyClasses).flat()),
      ].sort(),
      dependencyClasses,
      workspacePatterns: workspaceValue
        .filter((item): item is string => typeof item === "string")
        .map(canonical)
        .sort(),
      entryPoints,
      exports: exportKeys(value.exports),
      detector: "javascript-workspace",
      detectorVersion: JAVASCRIPT_WORKSPACE_DETECTOR_VERSION,
      completeness: "complete",
      diagnostics: [],
    };
  } catch {
    return {
      name: normalizedPath,
      path: normalizedPath,
      packageRoot,
      scripts: {},
      dependencies: [],
      dependencyClasses: {
        production: [],
        development: [],
        peer: [],
        optional: [],
      },
      workspacePatterns: [],
      entryPoints: [],
      exports: [],
      detector: "javascript-workspace",
      detectorVersion: JAVASCRIPT_WORKSPACE_DETECTOR_VERSION,
      completeness: "partial",
      diagnostics: ["invalid package.json"],
    };
  }
}

export function detectJavascriptWorkspaceManagers(paths: readonly string[]): {
  readonly managers: readonly ("npm" | "pnpm" | "yarn")[];
  readonly conflicts: readonly string[];
} {
  const names = new Set(paths.map((path) => canonical(path).split("/").at(-1)));
  const managers = (
    [
      ["npm", "package-lock.json"],
      ["pnpm", "pnpm-workspace.yaml"],
      ["yarn", "yarn.lock"],
    ] as const
  )
    .filter(([, marker]) => names.has(marker))
    .map(([manager]) => manager);
  return {
    managers,
    conflicts:
      managers.length > 1
        ? [`conflicting workspace managers: ${managers.join(", ")}`]
        : [],
  };
}

export function workspaceDiagnostics(packages: readonly JsPackageFact[]) {
  const seen = new Set<string>();
  const diagnostics: string[] = [];
  for (const package_ of [...packages].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    if (seen.has(package_.name))
      diagnostics.push(`duplicate package name: ${package_.name}`);
    seen.add(package_.name);
    diagnostics.push(
      ...package_.diagnostics.map((item) => `${package_.path}: ${item}`),
    );
  }
  return diagnostics.sort();
}
