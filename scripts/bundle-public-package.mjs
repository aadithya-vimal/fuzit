import { build } from "esbuild";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const targets = {
  cli: {
    entryPoints: {
      bin: resolve(root, "apps/cli/src/bin.ts"),
      index: resolve(root, "apps/cli/src/index.ts"),
    },
    outdir: resolve(root, "apps/cli/dist"),
    platform: "node",
    external: ["commander", "typescript"],
  },
  mcp: {
    entryPoints: {
      bin: resolve(root, "apps/mcp-server/src/bin.ts"),
      index: resolve(root, "apps/mcp-server/src/index.ts"),
    },
    outdir: resolve(root, "apps/mcp-server/dist"),
    platform: "node",
    external: [],
  },
  vscode: {
    entryPoints: {
      extension: resolve(root, "apps/vscode-extension/src/extension.ts"),
      index: resolve(root, "apps/vscode-extension/src/index.ts"),
      "multi-root": resolve(root, "apps/vscode-extension/src/multi-root.ts"),
    },
    outdir: resolve(root, "apps/vscode-extension/dist"),
    platform: "node",
    external: ["vscode"],
  },
  sdk: {
    entryPoints: {
      index: resolve(root, "packages/plugin-sdk/src/index.ts"),
    },
    outdir: resolve(root, "packages/plugin-sdk/dist"),
    platform: "node",
    external: [],
  },
};

const targetName = process.argv[2];
const target = targets[targetName];
if (!target) {
  throw new Error(
    `Unknown public bundle target '${targetName ?? ""}'. Expected: ${Object.keys(targets).join(", ")}.`,
  );
}

await build({
  ...target,
  absWorkingDir: root,
  bundle: true,
  format: "esm",
  target: "node24",
  sourcemap: false,
  legalComments: "none",
  treeShaking: true,
  logLevel: "info",
});

if (targetName === "sdk") {
  const vendor = resolve(root, "packages/plugin-sdk/dist/vendor/schemas");
  await rm(vendor, { recursive: true, force: true });
  await cp(resolve(root, "packages/schemas/dist"), vendor, {
    recursive: true,
    filter: (source) =>
      !source.includes(".") ||
      source.endsWith(".d.ts") ||
      !source.split(/[\\/]/).at(-1).includes("."),
  });
  for (const declaration of ["index.d.ts", "extension-points.d.ts"]) {
    const path = resolve(root, "packages/plugin-sdk/dist", declaration);
    const source = await readFile(path, "utf8");
    await writeFile(
      path,
      source.replaceAll("@fuzit/schemas", "./vendor/schemas/index.js"),
    );
  }
}
