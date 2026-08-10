import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(".");

function run(command, args, options = {}) {
  const executable = command === "pnpm" ? process.execPath : command;
  const safeArguments =
    command === "pnpm" ? [process.env.npm_execpath, ...args] : args;
  const result = spawnSync(executable, safeArguments, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: false,
    env: options.env ?? process.env,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

export async function auditVsixPackage() {
  const temporary = await mkdtemp(join(tmpdir(), "fuzit-vsix-"));
  const artifacts = join(temporary, "artifacts");

  try {
    await mkdir(artifacts);

    // Verify package manifest security & privacy properties
    const manifestPath = join(root, "apps/vscode-extension/package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    if (manifest.private !== false) {
      throw new Error("VS Code extension manifest must be publishable");
    }

    if (
      manifest.scripts?.publish !== undefined ||
      manifest.scripts?.deploy !== undefined
    ) {
      throw new Error(
        "Marketplace publish/deploy scripts are explicitly forbidden",
      );
    }

    const archivePath = join(artifacts, `fuzit-${manifest.version}.vsix`);
    const staging = join(temporary, "extension");
    await mkdir(staging);
    await cp(join(root, "apps/vscode-extension/dist"), join(staging, "dist"), {
      recursive: true,
    });
    await cp(
      join(root, "apps/vscode-extension/README.md"),
      join(staging, "README.md"),
    );
    const vsixManifest = {
      ...manifest,
      name: "fuzit",
      dependencies: undefined,
      devDependencies: undefined,
      files: ["dist/**/*.js", "README.md"],
    };
    await writeFile(
      join(staging, "package.json"),
      `${JSON.stringify(vsixManifest, null, 2)}\n`,
    );
    run(
      process.execPath,
      [
        join(root, "node_modules", "@vscode", "vsce", "vsce"),
        "package",
        "--no-dependencies",
        "--out",
        archivePath,
      ],
      { cwd: staging, env: { ...process.env, SOURCE_DATE_EPOCH: "0" } },
    );
    const archiveBuffer = await readFile(archivePath);
    const sha256 = createHash("sha256").update(archiveBuffer).digest("hex");

    const fileList = run("tar", ["-tf", archivePath])
      .split(/\r?\n/)
      .filter(Boolean);

    const requiredEntries = [
      "[Content_Types].xml",
      "extension.vsixmanifest",
      "extension/package.json",
      "extension/dist/extension.js",
      "extension/dist/index.js",
      "extension/dist/multi-root.js",
    ];

    for (const entry of requiredEntries) {
      if (!fileList.includes(entry)) {
        throw new Error(`VSIX package missing required entry: ${entry}`);
      }
    }

    for (const forbidden of [
      ".map",
      "extension/src/",
      "implementation-plan/",
      ".v1-development/",
      ".fuzit-development/",
    ]) {
      if (fileList.some((entry) => entry.includes(forbidden))) {
        throw new Error(`VSIX package leaked forbidden content: ${forbidden}`);
      }
    }

    const locator = process.platform === "win32" ? "where.exe" : "which";
    const codeCandidates = run(locator, ["code"])
      .split(/\r?\n/)
      .filter(Boolean);
    const locatedCode =
      (process.platform === "win32"
        ? codeCandidates.find((candidate) => candidate.endsWith(".cmd"))
        : codeCandidates[0]) ?? "";
    if (locatedCode.length === 0) {
      throw new Error("A local VS Code extension host is required.");
    }
    let codeExecutable = locatedCode;
    let codePrefix = [];
    let codeEnvironment = process.env;
    if (locatedCode.endsWith(".cmd")) {
      const installRoot = resolve(dirname(locatedCode), "..");
      codeExecutable = join(installRoot, "Code.exe");
      for (const entry of (await readdir(installRoot)).sort()) {
        const candidate = join(
          installRoot,
          entry,
          "resources",
          "app",
          "out",
          "cli.js",
        );
        try {
          await access(candidate);
          codePrefix = [candidate];
          break;
        } catch {
          // Keep searching deterministic installation-version directories.
        }
      }
      if (codePrefix.length === 0) {
        throw new Error(
          "The local VS Code CLI entry point could not be found.",
        );
      }
      codeEnvironment = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        VSCODE_DEV: "",
      };
    }
    const extensionsDirectory = join(temporary, "extensions");
    const userDataDirectory = join(temporary, "user-data");
    await mkdir(extensionsDirectory);
    await mkdir(userDataDirectory);
    run(
      codeExecutable,
      [
        ...codePrefix,
        "--install-extension",
        archivePath,
        "--force",
        "--extensions-dir",
        extensionsDirectory,
        "--user-data-dir",
        userDataDirectory,
      ],
      { env: codeEnvironment },
    );
    const installed = run(
      codeExecutable,
      [
        ...codePrefix,
        "--list-extensions",
        "--extensions-dir",
        extensionsDirectory,
        "--user-data-dir",
        userDataDirectory,
      ],
      { env: codeEnvironment },
    );
    if (
      !installed
        .split(/\r?\n/)
        .includes(`${manifest.publisher}.${vsixManifest.name}`)
    ) {
      throw new Error(
        "Private VSIX did not install into the isolated extension host.",
      );
    }

    return {
      status: "verified",
      name: manifest.name,
      version: manifest.version,
      private: manifest.private,
      sha256,
      entryCount: fileList.length,
      extensionHostInstall: "ok",
      workspaceTrustSuite: "required-separately",
      marketplacePublicationConfigured: false,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const report = await auditVsixPackage();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("verify-vsix.mjs")) {
  await main();
}
