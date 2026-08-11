import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name: string;
  readonly exports?: Record<string, unknown>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

interface WorkspacePackage {
  readonly path: string;
  readonly manifest: PackageManifest;
}

const repositoryRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const packagePaths = {
  "@fuzit/benchmark": "packages/benchmark",
  "@fuzit/analysis": "packages/analysis",
  "@fuzit/selection": "packages/selection",
  "@fuzit/provider-github": "packages/provider-github",
  "@fuzit/profiles": "packages/profiles",
  "@fuzit/git": "packages/git",
  "@fuzit/graph": "packages/graph",
  "@fuzit/index": "packages/index",
  "@fuzit/budgeting": "packages/budgeting",
  "@fuzit/cli": "apps/cli",
  "@fuzit/mcp-server": "apps/mcp-server",
  "@fuzit/config": "packages/config",
  "@fuzit/core": "packages/core",
  "@fuzit/discovery": "packages/discovery",
  "@fuzit/scanner": "packages/scanner",
  "@fuzit/snapshots": "packages/snapshots",
  "@fuzit/renderer-markdown": "packages/renderers/markdown",
  "@fuzit/renderer-core": "packages/renderers/core",
  "@fuzit/renderer-json": "packages/renderers/json",
  "@fuzit/renderer-text": "packages/renderers/text",
  "@fuzit/renderer-xml": "packages/renderers/xml",
  "@fuzit/security": "packages/security",
  "@fuzit/schemas": "packages/schemas",
  "@fuzit/testing": "packages/testing",
  "@fuzit/plugin-sdk": "packages/plugin-sdk",
  "@fuzit/plugin-host": "packages/plugin-host",
  "@fuzit/watcher": "packages/watcher",
  fuzit: "apps/vscode-extension",
} as const;

async function readManifest(relativePath: string): Promise<PackageManifest> {
  return JSON.parse(
    await readFile(join(repositoryRoot, relativePath, "package.json"), "utf8"),
  ) as PackageManifest;
}

function findProductionBoundaryViolations(
  workspacePackages: readonly WorkspacePackage[],
): string[] {
  const applicationNames = new Set(
    workspacePackages
      .filter(({ path }) => path.startsWith("apps/"))
      .map(({ manifest }) => manifest.name),
  );

  return workspacePackages
    .filter(({ path }) => path.startsWith("packages/"))
    .flatMap(({ manifest }) =>
      Object.keys(manifest.dependencies ?? {})
        .filter((dependency) => applicationNames.has(dependency))
        .map(
          (dependency) =>
            `${manifest.name} production-depends on application ${dependency}`,
        ),
    )
    .sort();
}

describe("minimal workspace topology", () => {
  it("enforces the declared dependency direction without cycles", async () => {
    const workspaceDirectories = (
      await Promise.all(
        ["apps", "packages", "packages/renderers"].map(async (directory) => {
          const entries = await readdir(join(repositoryRoot, directory), {
            withFileTypes: true,
          });

          return Promise.all(
            entries
              .filter((entry) => entry.isDirectory())
              .map(async (entry) => {
                const relativePath = join(directory, entry.name);
                try {
                  await access(
                    join(repositoryRoot, relativePath, "package.json"),
                  );
                  return relativePath.replaceAll("\\", "/");
                } catch {
                  return undefined;
                }
              }),
          );
        }),
      )
    )
      .flat()
      .filter((path): path is string => path !== undefined)
      .sort();

    expect(workspaceDirectories).toEqual(
      Object.values(packagePaths).slice().sort(),
    );

    const manifests = new Map<string, PackageManifest>();

    for (const relativePath of Object.values(packagePaths)) {
      const manifest = await readManifest(relativePath);
      manifests.set(manifest.name, manifest);
    }

    expect(
      Object.keys(manifests.get("@fuzit/profiles")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/selection")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/graph", "@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/analysis")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/git")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/provider-github", "@fuzit/schemas", "@fuzit/security"]);
    expect(
      Object.keys(manifests.get("@fuzit/index")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/schemas"]);
    expect(
      Object.keys(
        manifests.get("@fuzit/renderer-text")?.dependencies ?? {},
      ).filter((dependency) => dependency.startsWith("@fuzit/")),
    ).toEqual(["@fuzit/core", "@fuzit/renderer-core", "@fuzit/schemas"]);
    expect(
      Object.keys(
        manifests.get("@fuzit/renderer-xml")?.dependencies ?? {},
      ).filter((dependency) => dependency.startsWith("@fuzit/")),
    ).toEqual(["@fuzit/core", "@fuzit/renderer-core", "@fuzit/schemas"]);
    expect(
      Object.keys(
        manifests.get("@fuzit/renderer-json")?.dependencies ?? {},
      ).filter((dependency) => dependency.startsWith("@fuzit/")),
    ).toEqual(["@fuzit/renderer-core", "@fuzit/schemas"]);
    expect(
      Object.keys(
        manifests.get("@fuzit/renderer-core")?.dependencies ?? {},
      ).filter((dependency) => dependency.startsWith("@fuzit/")),
    ).toEqual(["@fuzit/core", "@fuzit/schemas"]);
    expect(
      Object.keys(
        manifests.get("@fuzit/renderer-markdown")?.dependencies ?? {},
      ).filter((dependency) => dependency.startsWith("@fuzit/")),
    ).toEqual(["@fuzit/core", "@fuzit/renderer-core", "@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/budgeting")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/core")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/provider-github", "@fuzit/schemas", "@fuzit/security"]);
    expect(
      Object.keys(manifests.get("@fuzit/discovery")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/core"]);
    expect(
      Object.keys(manifests.get("@fuzit/scanner")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/core", "@fuzit/schemas", "@fuzit/security"]);
    expect(
      Object.keys(manifests.get("@fuzit/security")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/watcher")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual(["@fuzit/index", "@fuzit/schemas"]);
    expect(
      Object.keys(manifests.get("@fuzit/cli")?.dependencies ?? {}).filter(
        (dependency) => dependency.startsWith("@fuzit/"),
      ),
    ).toEqual([]);

    for (const manifest of manifests.values()) {
      expect(manifest.dependencies ?? {}).not.toHaveProperty("@fuzit/testing");
    }

    const workspacePackages = Object.entries(packagePaths).map(
      ([name, path]) => ({
        path,
        manifest: manifests.get(name) as PackageManifest,
      }),
    );
    expect(findProductionBoundaryViolations(workspacePackages)).toEqual([]);

    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(packageName: string): void {
      if (visiting.has(packageName)) {
        throw new Error(`circular workspace dependency through ${packageName}`);
      }
      if (visited.has(packageName)) {
        return;
      }

      visiting.add(packageName);
      const manifest = manifests.get(packageName);
      const dependencies = {
        ...manifest?.dependencies,
        ...manifest?.devDependencies,
      };

      for (const dependency of Object.keys(dependencies)) {
        if (manifests.has(dependency)) {
          visit(dependency);
        }
      }

      visiting.delete(packageName);
      visited.add(packageName);
    }

    for (const packageName of manifests.keys()) {
      visit(packageName);
    }
  });

  it("rejects a production library dependency on an application", () => {
    const invalidTopology: WorkspacePackage[] = [
      {
        path: "apps/example",
        manifest: { name: "@fuzit/example-app" },
      },
      {
        path: "packages/core",
        manifest: {
          name: "@fuzit/core",
          dependencies: { "@fuzit/example-app": "workspace:*" },
        },
      },
    ];

    expect(findProductionBoundaryViolations(invalidTopology)).toEqual([
      "@fuzit/core production-depends on application @fuzit/example-app",
    ]);
  });

  it("exposes a narrow root entry point from every workspace package", async () => {
    const manifests = await Promise.all(
      Object.values(packagePaths).map(readManifest),
    );

    for (const manifest of manifests) {
      expect(manifest.exports).toHaveProperty(".");
    }

    const modules = await Promise.all([
      import("../../../apps/cli/src/index.js"),
      import("../../analysis/src/index.js"),
      import("../../selection/src/index.js"),
      import("../../provider-github/src/index.js"),
      import("../../profiles/src/index.js"),
      import("../../git/src/index.js"),
      import("../../graph/src/index.js"),
      import("../../index/src/index.js"),
      import("../../budgeting/src/index.js"),
      import("../../config/src/index.js"),
      import("../../core/src/index.js"),
      import("../../discovery/src/index.js"),
      import("../../scanner/src/index.js"),
      import("../../snapshots/src/index.js"),
      import("../../renderers/markdown/src/index.js"),
      import("../../renderers/core/src/index.js"),
      import("../../renderers/json/src/index.js"),
      import("../../renderers/text/src/index.js"),
      import("../../renderers/xml/src/index.js"),
      import("../../security/src/index.js"),
      import("../../schemas/src/index.js"),
      import("../../watcher/src/index.js"),
      import("./index.js"),
    ]);

    expect(modules).toHaveLength(23);
  }, 15_000);
});
