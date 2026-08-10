import { createRequire } from "node:module";
import { access, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowedLicenses = new Set([
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
]);

const manifests = async (directory) => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await manifests(path)));
    else if (entry.name === "package.json") found.push(path);
  }
  return found;
};

const dependencyManifest = async (requester, name) => {
  let current = dirname(createRequire(requester).resolve(name));
  for (;;) {
    const candidate = resolve(current, "package.json");
    try {
      await access(candidate);
      const manifest = JSON.parse(await readFile(candidate, "utf8"));
      if (manifest.name === name)
        return { manifest, path: await realpath(candidate) };
    } catch {
      // Continue upward until the dependency's own manifest is found.
    }
    const parent = dirname(current);
    if (parent === current)
      throw new Error(`cannot locate runtime manifest: ${name}`);
    current = parent;
  }
};

export const auditLicenses = async (root = repositoryRoot) => {
  const paths = [
    ...(await manifests(resolve(root, "apps"))),
    ...(await manifests(resolve(root, "packages"))),
  ].sort();
  const external = new Map();
  for (const path of paths) {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    for (const [name, version] of Object.entries(
      manifest.dependencies ?? {},
    ).sort()) {
      if (String(version).startsWith("workspace:")) continue;
      const { manifest: dependency, path: packagePath } =
        await dependencyManifest(path, name);
      const license = dependency.license;
      if (typeof license !== "string" || !allowedLicenses.has(license)) {
        throw new Error(
          `unknown or blocked runtime license: ${name}@${dependency.version} (${String(license)})`,
        );
      }
      external.set(name, {
        name,
        version: dependency.version,
        license,
        status: "allowed",
        evidence: relative(root, packagePath).replaceAll("\\", "/"),
      });
    }
  }
  return {
    schemaVersion: 1,
    scope:
      "external runtime dependencies reachable from distributable workspaces",
    packages: [...external.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    findings: {
      blocked: 0,
      review: 0,
      unknown: 0,
      copyleft: 0,
      nativeOrWasm: 0,
      devOnlyExcluded: true,
    },
  };
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const actual = await auditLicenses();
  const reportPath = resolve(
    repositoryRoot,
    "docs/release/dependency-license-audit.json",
  );
  const expected = JSON.parse(await readFile(reportPath, "utf8"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("dependency license audit report is stale or incomplete");
  }
  process.stdout.write(`${JSON.stringify(actual)}\n`);
}
