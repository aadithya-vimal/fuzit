import { resolve } from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { parsePluginManifest, type PluginManifest } from "@fuzit/plugin-sdk";
import {
  validatePluginCompatibility,
  type CompatibilityValidationResult,
} from "@fuzit/plugin-host";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

export interface PluginCommandDependencies {
  readonly workingDirectory?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly json?: boolean;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic?: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

export interface DiscoveredPluginInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly path: string;
  readonly manifest: PluginManifest;
  readonly compatibility: CompatibilityValidationResult;
  readonly enabled: boolean;
}

export async function findPluginManifestPaths(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function scan(currentDir: string, depth: number) {
    if (depth > 4) return;
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        const fullPath = resolve(currentDir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name === "fuzit-plugin.json") {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore unreadable directories
    }
  }

  await scan(dir, 0);
  return results.sort();
}

export async function discoverPlugins(
  rootDir: string,
): Promise<DiscoveredPluginInfo[]> {
  const manifestPaths = await findPluginManifestPaths(rootDir);
  const plugins: DiscoveredPluginInfo[] = [];

  for (const manifestPath of manifestPaths) {
    try {
      const content = await readFile(manifestPath, "utf8");
      const rawJson = JSON.parse(content);
      const manifest = parsePluginManifest(rawJson);
      const compatibility = validatePluginCompatibility(manifest);
      plugins.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        path: manifestPath,
        manifest,
        compatibility,
        enabled: compatibility.compatible,
      });
    } catch {
      // Skip invalid manifests during discovery
    }
  }

  return plugins;
}

export function registerPluginCommand(
  program: Command,
  dependencies: PluginCommandDependencies,
): void {
  const pluginCmd = program
    .command("plugin")
    .description("manage and audit local Fuzit plugins");

  pluginCmd
    .command("list")
    .description("list discovered local plugins")
    .option("--dir <path>", "directory to scan for plugins")
    .action(async (options: { dir?: string }) => {
      const targetDir = resolve(
        options.dir ?? dependencies.workingDirectory ?? process.cwd(),
      );
      const plugins = await discoverPlugins(targetDir);

      if (dependencies.json) {
        dependencies.writeData(
          plugins.map((p) => ({
            id: p.id,
            name: p.name,
            version: p.version,
            path: p.path,
            compatible: p.compatibility.compatible,
            enabled: p.enabled,
            capabilities: p.manifest.capabilities,
          })),
        );
      } else {
        if (plugins.length === 0) {
          dependencies.writeData("No plugins found.");
        } else {
          const lines = plugins.map(
            (p) =>
              `${p.id}@${p.version} - ${p.name} [${
                p.compatibility.compatible ? "Compatible" : "Incompatible"
              }] (${p.path})`,
          );
          dependencies.writeData(["Discovered plugins:", ...lines].join("\n"));
        }
      }
      dependencies.setExitCode(EXIT_CODES.success);
    });

  pluginCmd
    .command("inspect")
    .description("inspect manifest and permissions for a specific plugin")
    .argument(
      "<plugin-path-or-id>",
      "path to plugin directory/manifest or plugin ID",
    )
    .action(async (target: string) => {
      const rootDir = resolve(dependencies.workingDirectory ?? process.cwd());
      let manifestPath: string | undefined;

      if (target.endsWith("fuzit-plugin.json")) {
        manifestPath = resolve(rootDir, target);
      } else {
        // Try direct path or scan
        const targetAsPath = resolve(rootDir, target);
        try {
          const stats = await stat(targetAsPath);
          if (stats.isDirectory()) {
            manifestPath = resolve(targetAsPath, "fuzit-plugin.json");
          }
        } catch {
          // Find by ID
          const discovered = await discoverPlugins(rootDir);
          const found = discovered.find((p) => p.id === target);
          if (found) {
            manifestPath = found.path;
          }
        }
      }

      if (!manifestPath) {
        if (dependencies.writeDiagnostic) {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: "PLUGIN.NOT_FOUND",
            severity: "error",
            source: "plugin",
            message: `Plugin '${target}' could not be located.`,
          });
        } else {
          dependencies.writeData(
            `Error: Plugin '${target}' could not be located.`,
          );
        }
        dependencies.setExitCode(EXIT_CODES.validation);
        return;
      }

      try {
        const content = await readFile(manifestPath, "utf8");
        const rawJson = JSON.parse(content);
        const manifest = parsePluginManifest(rawJson);
        const compatibility = validatePluginCompatibility(manifest);
        const perms = manifest.permissions;
        const effectivePermissions = {
          filesystemReadPaths: perms?.filesystem?.readPaths ?? [],
          filesystemWritePaths: perms?.filesystem?.writePaths ?? [],
          networkAllowedHosts: perms?.network?.allowedHosts ?? [],
          shellAllowed: perms?.shell === true,
          persistenceAllowed: perms?.persistence === true,
        };

        const info = {
          manifest,
          compatibility,
          declaredPermissions: manifest.permissions ?? {},
          effectivePermissions,
        };

        if (dependencies.json) {
          dependencies.writeData(info);
        } else {
          dependencies.writeData(
            [
              `Plugin: ${manifest.name} (${manifest.id})`,
              `Version: ${manifest.version}`,
              `Protocol: ${manifest.protocol}`,
              `Required Fuzit Version: ${manifest.fuzitVersion}`,
              `Capabilities: ${manifest.capabilities.join(", ")}`,
              `Compatible: ${compatibility.compatible ? "Yes" : "No"}`,
              compatibility.reasons.length > 0
                ? `Incompatibility Reasons: ${compatibility.reasons.join("; ")}`
                : null,
              `Entry Point: ${manifest.entryPoint}`,
              `Permissions:`,
              `  Filesystem Read: ${
                info.effectivePermissions.filesystemReadPaths.length > 0
                  ? info.effectivePermissions.filesystemReadPaths.join(", ")
                  : "None"
              }`,
              `  Filesystem Write: ${
                info.effectivePermissions.filesystemWritePaths.length > 0
                  ? info.effectivePermissions.filesystemWritePaths.join(", ")
                  : "None"
              }`,
              `  Network Hosts: ${
                info.effectivePermissions.networkAllowedHosts.length > 0
                  ? info.effectivePermissions.networkAllowedHosts.join(", ")
                  : "None"
              }`,
              `  Shell Execution: ${
                info.effectivePermissions.shellAllowed ? "Allowed" : "Denied"
              }`,
              `  Persistence: ${
                info.effectivePermissions.persistenceAllowed
                  ? "Allowed"
                  : "Denied"
              }`,
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (dependencies.writeDiagnostic) {
          dependencies.writeDiagnostic(
            {
              schemaVersion: 1,
              code: "PLUGIN.INVALID_MANIFEST",
              severity: "error",
              source: "plugin",
              message: `Failed to inspect plugin: ${msg}`,
            },
            error,
          );
        } else {
          dependencies.writeData(`Error: Failed to inspect plugin: ${msg}`);
        }
        dependencies.setExitCode(EXIT_CODES.validation);
      }
    });

  pluginCmd
    .command("validate")
    .description("validate plugin manifest schema and compatibility")
    .argument("<manifest-path>", "path to fuzit-plugin.json manifest")
    .action(async (manifestPathArg: string) => {
      const fullPath = resolve(
        dependencies.workingDirectory ?? process.cwd(),
        manifestPathArg,
      );
      try {
        const content = await readFile(fullPath, "utf8");
        const rawJson = JSON.parse(content);
        const manifest = parsePluginManifest(rawJson);
        const compatibility = validatePluginCompatibility(manifest);

        if (dependencies.json) {
          dependencies.writeData({
            valid: compatibility.compatible,
            manifest,
            compatibility,
          });
        } else {
          if (compatibility.compatible) {
            dependencies.writeData(
              `PASS Plugin manifest at ${manifestPathArg} is valid and compatible.`,
            );
          } else {
            dependencies.writeData(
              `FAIL Plugin manifest at ${manifestPathArg} is incompatible:\n${compatibility.reasons
                .map((r: string) => `  - ${r}`)
                .join("\n")}`,
            );
          }
        }

        dependencies.setExitCode(
          compatibility.compatible ? EXIT_CODES.success : EXIT_CODES.validation,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (dependencies.json) {
          dependencies.writeData({
            valid: false,
            error: msg,
          });
        } else {
          dependencies.writeData(
            `FAIL Invalid plugin manifest at ${manifestPathArg}: ${msg}`,
          );
        }
        dependencies.setExitCode(EXIT_CODES.validation);
      }
    });

  pluginCmd
    .command("enable")
    .description("report plugin permission audit before enablement")
    .argument("<plugin-id>", "plugin ID to enable")
    .action(async (pluginId: string) => {
      const rootDir = resolve(dependencies.workingDirectory ?? process.cwd());
      const plugins = await discoverPlugins(rootDir);
      const found = plugins.find((p) => p.id === pluginId);

      if (!found) {
        if (dependencies.writeDiagnostic) {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: "PLUGIN.NOT_FOUND",
            severity: "error",
            source: "plugin",
            message: `Plugin '${pluginId}' not found.`,
          });
        } else {
          dependencies.writeData(`Error: Plugin '${pluginId}' not found.`);
        }
        dependencies.setExitCode(EXIT_CODES.validation);
        return;
      }

      if (!found.compatibility.compatible) {
        if (dependencies.writeDiagnostic) {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: "PLUGIN.INCOMPATIBLE",
            severity: "error",
            source: "plugin",
            message: `Cannot enable incompatible plugin '${pluginId}': ${found.compatibility.reasons.join("; ")}`,
          });
        } else {
          dependencies.writeData(
            `Error: Cannot enable incompatible plugin '${pluginId}': ${found.compatibility.reasons.join("; ")}`,
          );
        }
        dependencies.setExitCode(EXIT_CODES.validation);
        return;
      }

      const perms = found.manifest.permissions;
      const effective = {
        filesystemReadPaths: perms?.filesystem?.readPaths ?? [],
        filesystemWritePaths: perms?.filesystem?.writePaths ?? [],
        networkAllowedHosts: perms?.network?.allowedHosts ?? [],
        shellAllowed: perms?.shell === true,
        persistenceAllowed: perms?.persistence === true,
      };

      const result = {
        id: found.id,
        name: found.name,
        enabled: true,
        grantedPermissions: effective,
      };

      if (dependencies.json) {
        dependencies.writeData(result);
      } else {
        dependencies.writeData(
          [
            `Plugin '${found.id}' enabled successfully.`,
            `Granted Permissions Audit:`,
            `  Filesystem Read: ${effective.filesystemReadPaths.length > 0 ? effective.filesystemReadPaths.join(", ") : "None"}`,
            `  Filesystem Write: ${effective.filesystemWritePaths.length > 0 ? effective.filesystemWritePaths.join(", ") : "None"}`,
            `  Network Hosts: ${effective.networkAllowedHosts.length > 0 ? effective.networkAllowedHosts.join(", ") : "None"}`,
            `  Shell Execution: ${effective.shellAllowed ? "Allowed" : "Denied"}`,
            `  Persistence: ${effective.persistenceAllowed ? "Allowed" : "Denied"}`,
          ].join("\n"),
        );
      }

      dependencies.setExitCode(EXIT_CODES.success);
    });

  pluginCmd
    .command("disable")
    .description("disable a local plugin")
    .argument("<plugin-id>", "plugin ID to disable")
    .action(async (pluginId: string) => {
      const rootDir = resolve(dependencies.workingDirectory ?? process.cwd());
      const plugins = await discoverPlugins(rootDir);
      const found = plugins.find((p) => p.id === pluginId);

      if (!found) {
        if (dependencies.writeDiagnostic) {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: "PLUGIN.NOT_FOUND",
            severity: "error",
            source: "plugin",
            message: `Plugin '${pluginId}' not found.`,
          });
        } else {
          dependencies.writeData(`Error: Plugin '${pluginId}' not found.`);
        }
        dependencies.setExitCode(EXIT_CODES.validation);
        return;
      }

      const result = {
        id: found.id,
        name: found.name,
        enabled: false,
      };

      if (dependencies.json) {
        dependencies.writeData(result);
      } else {
        dependencies.writeData(`Plugin '${found.id}' has been disabled.`);
      }

      dependencies.setExitCode(EXIT_CODES.success);
    });

  pluginCmd
    .command("doctor")
    .description(
      "check local plugin environment readiness and security diagnostics",
    )
    .action(async () => {
      const rootDir = resolve(dependencies.workingDirectory ?? process.cwd());
      const plugins = await discoverPlugins(rootDir);

      const checks = plugins.map((p) => {
        if (!p.compatibility.compatible) {
          return {
            id: p.id,
            status: "fail",
            message: `Incompatible: ${p.compatibility.reasons.join("; ")}`,
          };
        }
        const hasShell = p.manifest.permissions?.shell === true;
        if (hasShell) {
          return {
            id: p.id,
            status: "warning",
            message: `Requests dangerous permission: shell execution`,
          };
        }
        return {
          id: p.id,
          status: "pass",
          message: `Plugin manifest and permissions are healthy`,
        };
      });

      const hasFailures = checks.some((c) => c.status === "fail");
      const report = {
        status: hasFailures ? "issues_detected" : "ready",
        totalPlugins: plugins.length,
        checks,
      };

      if (dependencies.json) {
        dependencies.writeData(report);
      } else {
        const lines = checks.map(
          (c) => `${c.status.toUpperCase()} ${c.id}: ${c.message}`,
        );
        dependencies.writeData(
          [
            `Fuzit plugin doctor (${plugins.length} plugins audited)`,
            plugins.length === 0 ? "No local plugins found." : lines.join("\n"),
          ].join("\n"),
        );
      }

      dependencies.setExitCode(
        hasFailures ? EXIT_CODES.environment : EXIT_CODES.success,
      );
    });
}
