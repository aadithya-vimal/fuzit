export const GO_BUILD_DETECTOR_VERSION = "1";

export interface GoManifestResult {
  readonly ecosystem: "go";
  readonly path: string;
  readonly format: "go.mod" | "go.work";
  readonly module: string | null;
  readonly goVersion: string | null;
  readonly dependencies: readonly string[];
  readonly replacements: readonly {
    readonly from: string;
    readonly to: string;
  }[];
  readonly useDirectories: readonly string[];
  readonly dynamic: boolean;
  readonly completeness: "complete" | "partial";
  readonly diagnostics: readonly string[];
  readonly detectorVersion: string;
}

export function parseGoManifest(
  source: string,
  path = "go.mod",
): GoManifestResult {
  const normalizedPath = path.replaceAll("\\", "/");
  const isWork =
    normalizedPath.endsWith("go.work") || /^\s*use\s/m.test(source);
  const moduleMatch = /^module\s+(\S+)/m.exec(source);
  const moduleName = moduleMatch?.[1] ?? null;
  const goVersion = /^go\s+([0-9.]+)/m.exec(source)?.[1] ?? null;

  const dependencies: string[] = [];
  for (const match of source.matchAll(/^require\s+(\S+)(?:\s+\S+)?/gm)) {
    if (match[1] && match[1] !== "(") dependencies.push(match[1]);
  }
  for (const block of source.matchAll(/require\s*\(([\s\S]*?)\)/g)) {
    for (const line of block[1]!.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const parts = trimmed.split(/\s+/);
      if (parts[0] && parts[0] !== ")") dependencies.push(parts[0]);
    }
  }

  const replacements: { from: string; to: string }[] = [];
  for (const match of source.matchAll(/^replace\s+(\S+)\s+=>\s+(\S+)/gm)) {
    replacements.push({ from: match[1]!, to: match[2]! });
  }
  for (const block of source.matchAll(/replace\s*\(([\s\S]*?)\)/g)) {
    for (const line of block[1]!.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const parts = trimmed.split(/\s+=>\s+/);
      if (parts.length === 2) {
        const from = parts[0]!.trim().split(/\s+/)[0]!;
        const to = parts[1]!.trim().split(/\s+/)[0]!;
        replacements.push({ from, to });
      }
    }
  }

  const useDirectories: string[] = [];
  for (const match of source.matchAll(/^use\s+(\S+)/gm)) {
    if (match[1] && match[1] !== "(") useDirectories.push(match[1]);
  }
  for (const block of source.matchAll(/use\s*\(([\s\S]*?)\)/g)) {
    for (const line of block[1]!.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const dir = trimmed.split(/\s+/)[0]!;
      if (dir && dir !== ")") useDirectories.push(dir);
    }
  }

  const hasBuildTag = /\/\/\s*(?:go:build|\+build)/u.test(source);
  const isMalformed = !isWork && !moduleName && /^\s*require\b/m.test(source);
  const diagnostics = [
    ...(hasBuildTag ? ["unsupported-build-tag"] : []),
    ...(isMalformed ? ["malformed-manifest"] : []),
  ].sort();

  return {
    ecosystem: "go",
    path: normalizedPath,
    format: isWork ? "go.work" : "go.mod",
    module: moduleName,
    goVersion,
    dependencies: [...new Set(dependencies)].sort(),
    replacements,
    useDirectories: [...new Set(useDirectories)].sort(),
    dynamic: false,
    completeness: diagnostics.length === 0 ? "complete" : "partial",
    diagnostics,
    detectorVersion: GO_BUILD_DETECTOR_VERSION,
  };
}
