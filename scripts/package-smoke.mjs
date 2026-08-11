import { spawn, spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";

const root = resolve(".");
const temporaryParent = process.env.FUZIT_PACKAGE_TEMP_PARENT ?? tmpdir();
await mkdir(temporaryParent, { recursive: true });
const temporary = await mkdtemp(join(temporaryParent, "fuzit-package-"));
const artifacts = join(temporary, "artifacts");
const installation = join(temporary, "install");

function run(command, arguments_, options = {}) {
  const executable = command === "pnpm" ? process.execPath : command;
  const safeArguments =
    command === "pnpm" ? [process.env.npm_execpath, ...arguments_] : arguments_;
  const result = spawnSync(executable, safeArguments, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: false,
    env: options.env ?? process.env,
    input: options.input,
  });
  if (!(options.acceptedStatuses ?? [0]).includes(result.status)) {
    throw new Error(
      `${command} ${arguments_.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

try {
  await mkdir(artifacts);
  await mkdir(installation);
  const packageDirectories = [
    "apps/cli",
    "apps/mcp-server",
    "packages/plugin-sdk",
  ];
  const packageNames = new Map();
  for (const directory of packageDirectories.sort()) {
    const manifest = JSON.parse(
      await readFile(join(root, directory, "package.json"), "utf8"),
    );
    run("pnpm", ["--dir", directory, "pack", "--pack-destination", artifacts]);
    packageNames.set(
      manifest.name,
      manifest.name.startsWith("@fuzit/")
        ? `fuzit-${manifest.name.split("/").at(-1)}-${manifest.version}.tgz`
        : `${manifest.name}-${manifest.version}.tgz`,
    );
  }
  const tarballs = (await readdir(artifacts))
    .filter((path) => path.endsWith(".tgz"))
    .map((path) => join(artifacts, path));
  if (tarballs.length !== packageDirectories.length)
    throw new Error("Not every public npm package produced a tarball.");
  const cliTarball = tarballs.find((path) =>
    /fuzit-cli-\d+\.\d+\.\d+\.tgz$/.test(path),
  );
  if (cliTarball === undefined) throw new Error("CLI tarball missing.");
  const contents = run("tar", ["-tf", cliTarball]);
  for (const required of [
    "package/bin/fuzit.mjs",
    "package/dist/bin.js",
    "package/package.json",
  ]) {
    if (!contents.includes(required))
      throw new Error(`CLI package content missing: ${required}`);
  }
  if (contents.includes("package/src/"))
    throw new Error("CLI tarball leaked workspace source.");
  const sdkTarball = tarballs.find((path) => /fuzit-plugin-sdk-/.test(path));
  if (sdkTarball === undefined) throw new Error("Plugin SDK tarball missing.");
  const sdkContents = run("tar", ["-tf", sdkTarball]);
  for (const forbidden of ["plugin-host", "testing", "node_modules", "src/"]) {
    if (sdkContents.includes(forbidden))
      throw new Error(`Plugin SDK package leaked ${forbidden}.`);
  }
  const privateWorkspaceNames = new Set([
    "@fuzit/analysis",
    "@fuzit/benchmark",
    "@fuzit/budgeting",
    "@fuzit/config",
    "@fuzit/core",
    "@fuzit/discovery",
    "@fuzit/git",
    "@fuzit/graph",
    "@fuzit/index",
    "@fuzit/plugin-host",
    "@fuzit/profiles",
    "@fuzit/provider-github",
    "@fuzit/renderer-core",
    "@fuzit/renderer-json",
    "@fuzit/renderer-markdown",
    "@fuzit/renderer-text",
    "@fuzit/renderer-xml",
    "@fuzit/scanner",
    "@fuzit/schemas",
    "@fuzit/security",
    "@fuzit/selection",
    "@fuzit/snapshots",
    "@fuzit/testing",
    "@fuzit/watcher",
  ]);
  for (const tarball of tarballs) {
    const packedManifest = JSON.parse(
      run("tar", ["-xOf", tarball, "package/package.json"]),
    );
    if (/"(?:workspace|file|link):/.test(JSON.stringify(packedManifest)))
      throw new Error(
        `Packed public package contains a local dependency reference: ${packedManifest.name}.`,
      );
    for (const [name, specification] of Object.entries({
      ...packedManifest.dependencies,
      ...packedManifest.optionalDependencies,
      ...packedManifest.peerDependencies,
    })) {
      if (privateWorkspaceNames.has(name))
        throw new Error(
          `Packed public package depends on private workspace ${name}.`,
        );
      if (/^(workspace|file|link):/.test(String(specification)))
        throw new Error(
          `Packed public package has local dependency ${name}@${specification}.`,
        );
    }
  }

  const publicDependencies = Object.fromEntries(
    [...packageNames].map(([name, tarball]) => [
      name,
      `file:${join(artifacts, tarball).replaceAll("\\", "/")}`,
    ]),
  );
  await writeFile(
    join(installation, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: publicDependencies,
    }),
  );
  run("pnpm", ["install", "--offline"], { cwd: installation });
  const referencePlugin = join(installation, "reference-plugin");
  await mkdir(referencePlugin);
  await writeFile(
    join(referencePlugin, "plugin.ts"),
    `import { createPlugin, type PluginParserOutput } from "@fuzit/plugin-sdk";\n\nconst output: PluginParserOutput = { symbols: [] };\nexport default createPlugin({\n  manifest: {\n    schemaVersion: 1,\n    id: "com.example.reference",\n    name: "Reference Plugin",\n    version: "1.0.0",\n    protocol: "fuzit-plugin-v1",\n    fuzitVersion: "^1.0.0",\n    entryPoint: "dist/plugin.js",\n    capabilities: ["parser"],\n    permissions: {\n      shell: false,\n      persistence: false,\n      filesystem: { readPaths: ["src/"] },\n    },\n  },\n  handlers: { parser: () => output },\n});\n`,
  );
  await writeFile(
    join(referencePlugin, "tsconfig.json"),
    `${JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        skipLibCheck: true,
        types: [],
      },
      files: ["plugin.ts"],
    })}\n`,
  );
  const typeScriptCompiler = join(
    root,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
  );
  run(process.execPath, [typeScriptCompiler, "--project", referencePlugin], {
    cwd: installation,
  });
  await writeFile(
    join(referencePlugin, "internal.ts"),
    'import "@fuzit/plugin-sdk/extension-points";\n',
  );
  run(
    process.execPath,
    [
      typeScriptCompiler,
      "--noEmit",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      join(referencePlugin, "internal.ts"),
    ],
    { cwd: installation, acceptedStatuses: [2] },
  );
  const executableDirectory = join(installation, "node_modules", ".bin");
  const environment = {
    ...process.env,
    PATH: `${executableDirectory}${delimiter}${process.env.PATH ?? ""}`,
  };
  const installedCli = join(
    installation,
    "node_modules",
    "@fuzit",
    "cli",
    "dist",
    "bin.js",
  );
  run(process.execPath, [installedCli, "--help"], {
    cwd: installation,
    env: environment,
  });
  run(process.execPath, [installedCli, "--version"], {
    cwd: installation,
    env: environment,
  });
  run(process.execPath, [installedCli, "doctor", "--json"], {
    cwd: installation,
    env: environment,
    acceptedStatuses: [0, 3],
  });
  const fixture = join(installation, "fixture");
  await mkdir(fixture);
  await writeFile(
    join(fixture, "authentication.ts"),
    "export const authentication = true;\n",
  );
  await writeFile(
    join(fixture, "graph.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      repositoryId: `sha256:${"a".repeat(64)}`,
      nodes: [],
      edges: [],
      diagnostics: [],
      completeness: "complete",
    })}\n`,
  );
  run("git", ["init", "--quiet"], { cwd: fixture });
  run(
    process.execPath,
    [installedCli, "scan", "--root", fixture, "--list-roots"],
    {
      cwd: installation,
      env: environment,
    },
  );
  run(
    process.execPath,
    [
      installedCli,
      "pack",
      "--root",
      fixture,
      "--format",
      "markdown",
      "--output",
      "pack.md",
    ],
    { cwd: installation, env: environment },
  );
  run(process.execPath, [installedCli, "watch", "--root", fixture, "--once"], {
    cwd: installation,
    env: { ...environment, FUZIT_CACHE_HOME: join(installation, "cache") },
  });
  run(process.execPath, [installedCli, "cache", "verify", "--root", fixture], {
    cwd: installation,
    env: { ...environment, FUZIT_CACHE_HOME: join(installation, "cache") },
  });
  run(
    process.execPath,
    [installedCli, "cache", "rebuild", "--root", fixture, "--dry-run"],
    {
      cwd: installation,
      env: { ...environment, FUZIT_CACHE_HOME: join(installation, "cache") },
    },
  );
  run(process.execPath, [installedCli, "cache", "rebuild", "--root", fixture], {
    cwd: installation,
    env: { ...environment, FUZIT_CACHE_HOME: join(installation, "cache") },
  });
  run(
    process.execPath,
    [installedCli, "graph", "stats", "--input", "fixture/graph.json"],
    { cwd: installation, env: environment },
  );
  const snapshotEnvironment = {
    ...environment,
    FUZIT_CACHE_HOME: join(installation, "cache"),
  };
  const firstSnapshot = JSON.parse(
    run(
      process.execPath,
      [installedCli, "--json", "snapshot", "create", "--root", fixture],
      {
        cwd: installation,
        env: snapshotEnvironment,
      },
    ),
  );
  await writeFile(
    join(fixture, "authentication.ts"),
    "export const authentication = false;\n",
  );
  const secondSnapshot = JSON.parse(
    run(
      process.execPath,
      [installedCli, "--json", "snapshot", "create", "--root", fixture],
      {
        cwd: installation,
        env: snapshotEnvironment,
      },
    ),
  );
  run(
    process.execPath,
    [installedCli, "diff", firstSnapshot.id, secondSnapshot.id],
    {
      cwd: installation,
      env: snapshotEnvironment,
    },
  );
  const pluginDirectory = join(installation, "plugin");
  await mkdir(pluginDirectory);
  const pluginManifest = join(pluginDirectory, "fuzit-plugin.json");
  await writeFile(
    pluginManifest,
    `${JSON.stringify({
      schemaVersion: 1,
      id: "com.example.clean-install",
      name: "Clean Install Plugin",
      version: "1.0.0",
      protocol: "fuzit-plugin-v1",
      fuzitVersion: "^1.0.0",
      entryPoint: "dist/plugin.js",
      capabilities: ["parser"],
      permissions: { filesystem: { readPaths: ["src/"] } },
    })}\n`,
  );
  run(process.execPath, [installedCli, "plugin", "validate", pluginManifest], {
    cwd: installation,
    env: environment,
  });
  const invalidPlugin = join(pluginDirectory, "invalid.json");
  await writeFile(invalidPlugin, "{}\n");
  run(process.execPath, [installedCli, "plugin", "validate", invalidPlugin], {
    cwd: installation,
    env: environment,
    acceptedStatuses: [2],
  });
  const installedMcp = join(
    installation,
    "node_modules",
    "@fuzit",
    "mcp-server",
    "dist",
    "bin.js",
  );
  const mcpOutput = await new Promise((resolveMcp, rejectMcp) => {
    const child = spawn(process.execPath, [installedMcp, fixture], {
      cwd: installation,
      env: environment,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let completed = false;
    const timeout = setTimeout(() => {
      child.kill();
      rejectMcp(new Error(`MCP clean-install startup timed out: ${stderr}`));
    }, 5_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes('"serverInfo"') && stdout.includes('"tools"')) {
        completed = true;
        clearTimeout(timeout);
        child.kill();
        resolveMcp(stdout);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectMcp(error);
    });
    child.on("exit", (code) => {
      if (!completed) {
        clearTimeout(timeout);
        rejectMcp(
          new Error(
            `MCP clean-install startup exited with status ${String(code)}: ${stderr}`,
          ),
        );
      }
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n` +
        `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`,
    );
  });
  if (!mcpOutput.includes('"serverInfo"') || !mcpOutput.includes('"tools"'))
    throw new Error(
      "MCP clean-install startup did not return capabilities and tools.",
    );
  run(
    process.execPath,
    [
      installedCli,
      "context",
      "--root",
      fixture,
      "--task",
      "authentication",
      "--profile",
      "bug-fix",
      "--budget-tokens",
      "1000",
      "--format",
      "markdown",
      "--output",
      join(installation, "context.md"),
    ],
    { cwd: installation, env: environment },
  );
  process.stdout.write(
    JSON.stringify({
      tarballs: tarballs.length,
      publicPackages: [...packageNames.keys()].sort(),
      packageContents: "audited",
      localInstall: "ok",
      isolation: "outside-monorepo",
      registryMode: "offline",
      privateWorkspacePackages: 0,
      globalBinShape: "ok",
      nativeDependencies: "none",
      nodeEngine: "validated",
      commands: [
        "--help",
        "--version",
        "doctor",
        "scan",
        "pack",
        "context",
        "watch --once",
        "graph stats",
        "snapshot create",
        "diff",
        "plugin validate",
        "plugin sdk compile",
        "plugin sdk internal export rejection",
        "mcp initialize",
        "mcp tools/list",
      ],
    }) + "\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
