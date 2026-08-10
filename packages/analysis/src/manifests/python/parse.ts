export const PYTHON_PACKAGING_DETECTOR_VERSION = "1";

export interface PythonManifestFact {
  ecosystem: "python";
  path: string;
  format: "pyproject" | "requirements" | "metadata" | "lock" | "unknown";
  name: string | null;
  dependencies: string[];
  includes: string[];
  entryPoints: string[];
  testConfiguration: string[];
  detector: "python-packaging";
  version: typeof PYTHON_PACKAGING_DETECTOR_VERSION;
  completeness: "complete" | "partial";
  diagnostics: string[];
}

function normalizedDependency(value: string): string {
  return value
    .trim()
    .split(/[<>=~!;\s[]/, 1)[0]!
    .toLowerCase();
}

function section(source: string, name: string): string {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `[${name}]`);
  if (start < 0) return "";
  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (/^\s*\[.+\]\s*$/.test(line)) break;
    body.push(line);
  }
  return body.join("\n");
}

export function parsePythonManifest(
  source: string,
  path = "requirements.txt",
): PythonManifestFact {
  const lowerPath = path.toLowerCase();
  const isPyproject = lowerPath.endsWith("pyproject.toml");
  const isRequirements = /(^|\/)requirements[^/]*\.(txt|in)$/.test(lowerPath);
  const isMetadata = /(^|\/)(metadata|pkg-info)$/.test(lowerPath);
  const isLock = /(^|\/)(poetry\.lock|pdm\.lock|uv\.lock)$/.test(lowerPath);
  const format = isPyproject
    ? "pyproject"
    : isRequirements
      ? "requirements"
      : isMetadata
        ? "metadata"
        : isLock
          ? "lock"
          : "unknown";
  const diagnostics: string[] = [];
  const dependencies: string[] = [];
  const includes: string[] = [];
  const entryPoints: string[] = [];
  const testConfiguration: string[] = [];
  let name: string | null = null;

  if (isPyproject) {
    const project = section(source, "project");
    const poetry = section(source, "tool.poetry");
    const poetryDependencies = section(source, "tool.poetry.dependencies");
    name =
      /(?:^|\n)\s*name\s*=\s*["']([^"']+)["']/.exec(project)?.[1] ??
      /(?:^|\n)\s*name\s*=\s*["']([^"']+)["']/.exec(poetry)?.[1] ??
      null;
    const dependencyArray =
      /(?:^|\n)\s*dependencies\s*=\s*\[([\s\S]*?)\]/.exec(project)?.[1] ?? "";
    dependencies.push(
      ...[...dependencyArray.matchAll(/["']([^"']+)["']/g)].map((match) =>
        normalizedDependency(match[1]!),
      ),
    );
    dependencies.push(
      ...[...poetryDependencies.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=/gm)]
        .map((match) => match[1]!.toLowerCase())
        .filter((dependency) => dependency !== "python"),
    );
    for (const group of [
      "project.scripts",
      "project.entry-points.console_scripts",
      "tool.poetry.scripts",
    ]) {
      entryPoints.push(
        ...[
          ...section(source, group).matchAll(
            /^\s*([^#=]+?)\s*=\s*["']([^"']+)["']/gm,
          ),
        ].map((match) => `${match[1]!.trim()}:${match[2]}`),
      );
    }
    if (section(source, "tool.pytest.ini_options"))
      testConfiguration.push("pytest");
    if (
      (source.match(/\[/g)?.length ?? 0) !== (source.match(/\]/g)?.length ?? 0)
    )
      diagnostics.push("malformed-toml");
  } else if (isRequirements) {
    includes.push(
      ...[...source.matchAll(/^\s*(?:-r|--requirement)\s+([^\s#]+).*$/gm)].map(
        (match) => match[1]!,
      ),
    );
    dependencies.push(
      ...[
        ...source.matchAll(/^\s*([A-Za-z0-9_.-]+)(?=\s*(?:\[|[=<>~!;]|$))/gm),
      ].map((match) => match[1]!.toLowerCase()),
    );
  } else if (isMetadata) {
    name = /^Name:\s*(.+)$/im.exec(source)?.[1]?.trim() ?? null;
    dependencies.push(
      ...[...source.matchAll(/^Requires-Dist:\s*(.+)$/gim)].map((match) =>
        normalizedDependency(match[1]!),
      ),
    );
  } else if (isLock) {
    dependencies.push(
      ...[...source.matchAll(/^name\s*=\s*["']([^"']+)["']/gm)].map((match) =>
        match[1]!.toLowerCase(),
      ),
    );
  } else diagnostics.push("unsupported-python-manifest");

  return {
    ecosystem: "python",
    path: path.replaceAll("\\", "/"),
    format,
    name,
    dependencies: [...new Set(dependencies)].sort(),
    includes: [...new Set(includes)].sort(),
    entryPoints: [...new Set(entryPoints)].sort(),
    testConfiguration: [...new Set(testConfiguration)].sort(),
    detector: "python-packaging",
    version: PYTHON_PACKAGING_DETECTOR_VERSION,
    completeness: diagnostics.length === 0 ? "complete" : "partial",
    diagnostics: [...new Set(diagnostics)].sort(),
  };
}

export function detectPythonPackageLayout(paths: readonly string[]): string[] {
  return [
    ...new Set(
      paths
        .map((path) => path.replaceAll("\\", "/"))
        .filter((path) =>
          /(^|\/)(?:src\/)?[A-Za-z_][A-Za-z0-9_]*\/(?:__init__\.py|py\.typed)$/.test(
            path,
          ),
        )
        .map((path) => path.replace(/\/(?:__init__\.py|py\.typed)$/, "")),
    ),
  ].sort();
}
