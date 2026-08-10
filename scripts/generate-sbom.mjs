import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = resolve(".");
const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "Python-2.0",
]);

function licenseId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.type === "string") return value.type;
  return "UNKNOWN";
}

async function locateDependency(packageDirectory, name) {
  let current = packageDirectory;
  for (;;) {
    const candidate = join(current, "node_modules", name, "package.json");
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      const parent = dirname(current);
      if (parent === current)
        throw new Error(`Missing installed dependency: ${name}`);
      current = parent;
    }
  }
}

export async function generateSbom({ packageManifestPaths }) {
  const components = new Map();
  const relationships = new Set();
  const licenseFindings = [];

  async function visit(manifestPath, rootComponent = false) {
    const bytes = await readFile(manifestPath);
    const manifest = JSON.parse(bytes.toString("utf8"));
    const reference = `pkg:npm/${encodeURIComponent(manifest.name)}@${manifest.version}`;
    if (components.has(reference)) return reference;
    const license = licenseId(manifest.license);
    const approved = allowedLicenses.has(license);
    components.set(reference, {
      bomRef: reference,
      name: manifest.name,
      version: manifest.version,
      license,
      integrity: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      root: rootComponent,
    });
    if (!approved) {
      licenseFindings.push({
        package: `${manifest.name}@${manifest.version}`,
        license,
        blocker: true,
        reason:
          license === "UNLICENSED" && manifest.name.startsWith("@fuzit/")
            ? "private package license requires owner authorization"
            : "unknown or disallowed dependency license",
      });
    }
    for (const name of Object.keys(manifest.dependencies ?? {}).sort()) {
      const dependencyPath = await locateDependency(
        dirname(manifestPath),
        name,
      );
      const dependencyReference = await visit(dependencyPath);
      relationships.add(`${reference}\0${dependencyReference}`);
    }
    return reference;
  }

  for (const path of [...packageManifestPaths].sort())
    await visit(resolve(path), true);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: "urn:uuid:00000000-0000-5000-8000-000000000001",
    version: 1,
    metadata: { tool: { name: "fuzit-sbom", version: "1" } },
    components: [...components.values()].sort((a, b) =>
      a.bomRef.localeCompare(b.bomRef),
    ),
    relationships: [...relationships].sort().map((value) => {
      const [from, to] = value.split("\0");
      return { from, to };
    }),
    licenseFindings: licenseFindings.sort((a, b) =>
      a.package.localeCompare(b.package),
    ),
    releaseEligible: licenseFindings.length === 0,
  };
}

export function assertDependencyLicenses(sbom) {
  const externalFindings = sbom.licenseFindings.filter(
    ({ package: name }) => !name.startsWith("@fuzit/"),
  );
  if (externalFindings.length > 0) {
    throw new Error(
      `SBOM contains blocked dependency licenses: ${externalFindings.map(({ package: name }) => name).join(", ")}`,
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const output = process.argv[2] ?? join(tmpdir(), "fuzit-sbom.json");
  const manifests = [
    "apps/cli/package.json",
    "apps/mcp-server/package.json",
    "apps/vscode-extension/package.json",
    "packages/plugin-sdk/package.json",
  ].map((path) => join(root, path));
  const sbom = await generateSbom({ packageManifestPaths: manifests });
  assertDependencyLicenses(sbom);
  await writeFile(resolve(output), `${JSON.stringify(sbom, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ output, components: sbom.components.length, releaseEligible: sbom.releaseEligible })}\n`,
  );
}
