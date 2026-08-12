import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import {
  detectFrameworks,
  detectLanguages,
  detectSourceRoots,
  extractDependencies,
  parseGoManifest,
  parseJavaManifest,
  parsePackageJson,
  parsePythonManifest,
} from "@fuzit/analysis";
import { loadEffectiveConfig, type EffectiveConfig } from "@fuzit/config";
import {
  createFileContextItem,
  normalizeRepositoryRelativePath,
  normalizeRepositoryIntelligence,
  securityFilter,
  type RepositoryIntelligence,
  type SecurityFilteredItem,
} from "@fuzit/core";
import { collectGitIdentity, collectGitStatus } from "@fuzit/git";
import {
  classifyFile,
  evaluateIgnorePrecedence,
  loadFuzitignoreRulesForPath,
  loadGitignoreRulesForPath,
  readTextContent,
  traverseDirectory,
  type ExplicitPathRule,
} from "@fuzit/scanner";

export interface RepositoryAcquisition {
  readonly root: string;
  readonly config: EffectiveConfig;
  readonly configHash: string;
  readonly items: readonly SecurityFilteredItem[];
  readonly omissions: readonly {
    path: string;
    reason: string;
    failure: boolean;
  }[];
  readonly complete: boolean;
}

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function projectRules(config: EffectiveConfig): ExplicitPathRule[] {
  return [
    ...config.values.exclude.map((pattern) => ({
      pattern,
      action: "exclude" as const,
      reason: "excluded by fuzit.config.json",
    })),
    ...config.values.include.map((pattern) => ({
      pattern,
      action: "include" as const,
      reason: "included by fuzit.config.json",
    })),
  ];
}

export async function acquireRepository(
  repositoryRoot: string,
  environment: Readonly<Record<string, string | undefined>> = {},
  overrides?: { maxFiles?: number; maximumBytes?: number; full?: boolean },
): Promise<RepositoryAcquisition> {
  const root = resolve(repositoryRoot);
  const config = await loadEffectiveConfig({
    repositoryRoot: root,
    environment,
    cli: overrides?.maxFiles !== undefined ? { maxFiles: overrides.maxFiles } : {},
  });
  const targetMaxBytes = overrides?.full
    ? Number.MAX_SAFE_INTEGER
    : overrides?.maximumBytes;
  const items: SecurityFilteredItem[] = [];
  const omissions: { path: string; reason: string; failure: boolean }[] = [];
  try {
    for await (const entry of traverseDirectory(root, {
      projectRules: projectRules(config),
      onExcluded: ({ path, reason }) => {
        omissions.push({ path, reason, failure: false });
      },
    })) {
      if (entry.kind !== "file") continue;
      const absolutePath = join(root, ...entry.path.split("/"));
      let record;
      try {
        record = await classifyFile(absolutePath, entry.path);
      } catch {
        omissions.push({
          path: entry.path,
          reason: "classification-failed",
          failure: true,
        });
        continue;
      }
      if (record.kind !== "text" || !record.readable) {
        omissions.push({
          path: entry.path,
          reason: record.kind === "binary" ? "binary" : "not-readable-text",
          failure: false,
        });
        continue;
      }
      let acquired: Awaited<ReturnType<typeof readTextContent>> | undefined;
      const result = await securityFilter({
        path: entry.path,
        readContent: async () => {
          acquired = await readTextContent(
            absolutePath,
            targetMaxBytes !== undefined ? { maximumBytes: targetMaxBytes } : {},
          );
          if (acquired.content === null) throw new Error("content unavailable");
          return acquired.content;
        },
        createItem: (content) =>
          createFileContextItem(record, {
            status: acquired?.status ?? "omitted",
            content,
            sha256: acquired?.sha256 ?? "0".repeat(64),
          }),
      });
      if (result.status === "success") items.push(result.item);
      else
        omissions.push({
          path: result.path,
          reason: result.reason,
          failure: result.status === "partial",
        });
    }
  } catch (error) {
    omissions.push({
      path: ".",
      reason: error instanceof Error ? error.message : "traversal-failed",
      failure: true,
    });
  }
  items.sort((left, right) => left.path.localeCompare(right.path, "en"));
  omissions.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return {
    root,
    config,
    configHash: stableHash(config.values),
    items,
    omissions,
    complete: !omissions.some(({ failure }) => failure),
  };
}

export function analyzeRepository(
  acquisition: RepositoryAcquisition,
): RepositoryIntelligence {
  const languages = detectLanguages(
    acquisition.items.map((item) => ({
      path: item.path,
      ...(item.content === null
        ? {}
        : { contentPrefix: item.content.slice(0, 256) }),
      generated: item.lifecycle === "generated",
      vendored: item.lifecycle === "vendored",
    })),
  ).map((fact) => fact.value);
  const packages: string[] = [];
  const frameworks: string[] = [];
  const tests: string[] = [];
  const entryPoints = detectSourceRoots(
    acquisition.items.map((item) => item.path),
  );
  const dependencies: string[] = [];
  const conflicts: string[] = [];
  let partial = !acquisition.complete;

  for (const item of acquisition.items) {
    const content = item.content ?? "";
    if (item.path.endsWith("package.json")) {
      const manifest = parsePackageJson(item.path, content);
      packages.push(`${manifest.name}:${manifest.path}`);
      dependencies.push(...manifest.dependencies);
      const detected = detectFrameworks({
        packageName: manifest.name,
        dependencies: manifest.dependencies,
        scripts: manifest.scripts,
      });
      frameworks.push(...detected.frameworks);
      tests.push(...detected.tests);
      entryPoints.push(
        ...detected.entryPoints.map((value) => `${item.path}:${value}`),
      );
      conflicts.push(...detected.conflicts);
      if (manifest.workspacePatterns.length > 0)
        packages.push(
          ...manifest.workspacePatterns.map(
            (pattern) => `workspace:${pattern}`,
          ),
        );
      partial ||= manifest.diagnostics.length > 0;
    } else if (item.path === "pnpm-workspace.yaml") {
      packages.push(
        ...[...content.matchAll(/^\s*-\s*["']?([^"'#\r\n]+)["']?\s*$/gm)].map(
          (match) => `workspace:${match[1]!.trim()}`,
        ),
      );
    } else if (/requirements(?:-[^/]*)?\.txt$/.test(item.path)) {
      const manifest = parsePythonManifest(content);
      packages.push(`python:${item.path}`);
      dependencies.push(...manifest.dependencies);
      if (manifest.dependencies.includes("pytest")) tests.push("pytest");
    } else if (item.path.endsWith("pom.xml")) {
      const manifest = parseJavaManifest(content);
      packages.push(`java:${item.path}`);
      dependencies.push(...manifest.dependencies);
      partial ||= manifest.dynamic;
    } else if (item.path.endsWith("go.mod") || item.path.endsWith("go.work")) {
      const manifest = parseGoManifest(content, item.path);
      packages.push(`go:${manifest.module ?? item.path}`);
      dependencies.push(...manifest.dependencies);
      dependencies.push(...manifest.replacements.map(({ from }) => from));
      const detected = detectFrameworks({
        packageName: manifest.module ?? item.path,
        dependencies: manifest.dependencies,
        scripts: {},
      });
      frameworks.push(...detected.frameworks);
      tests.push(...detected.tests);
      conflicts.push(...detected.conflicts);
      partial ||= manifest.diagnostics.length > 0;
    }
    dependencies.push(
      ...extractDependencies(item.path, content)
        .filter((edge) => edge.kind === "external" || edge.kind === "workspace")
        .map((edge) => edge.specifier),
    );
    if (
      /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\./.test(item.path)
    )
      tests.push(item.path);
  }

  return normalizeRepositoryIntelligence({
    languages,
    packages,
    frameworks,
    tests,
    entryPoints,
    dependencies,
    conflicts,
    partial,
  });
}

export async function repositoryIdentity(root: string): Promise<{
  readonly revision: string | null;
  readonly dirty: boolean;
  readonly fingerprint: string;
}> {
  const git = await collectGitIdentity(root);
  const remote = git.remotes.find(({ name }) => name === "origin")?.url;
  return {
    revision: git.head,
    dirty: git.dirty,
    fingerprint:
      git.available && remote !== undefined
        ? `git:${remote}`
        : `path:${resolve(root).replaceAll("\\", "/")}`,
  };
}

export async function repositorySnapshotIdentity(
  acquisition: RepositoryAcquisition,
): Promise<{
  readonly revision: string | null;
  readonly dirty: boolean;
}> {
  const identity = await collectGitIdentity(acquisition.root);
  if (!identity.available) return { revision: null, dirty: false };
  const included = new Set(acquisition.items.map(({ path }) => path));
  const changes = await collectGitStatus(acquisition.root);
  for (const change of changes) {
    if (included.has(change.path))
      return { revision: identity.head, dirty: true };
    if (change.kind !== "deleted" && change.kind !== "renamed") continue;
    const path = change.originalPath ?? change.path;
    const canonical = normalizeRepositoryRelativePath(path);
    const decision = evaluateIgnorePrecedence({
      path: canonical,
      isDirectory: false,
      projectRules: projectRules(acquisition.config),
      fuzitignoreRules: await loadFuzitignoreRulesForPath(acquisition.root),
      gitignoreRules: await loadGitignoreRulesForPath(
        acquisition.root,
        canonical,
      ),
    });
    if (!decision.excluded) return { revision: identity.head, dirty: true };
  }
  return { revision: identity.head, dirty: false };
}

export function acquisitionContentHash(
  acquisition: RepositoryAcquisition,
): string {
  return stableHash(
    acquisition.items.map(({ path, sha256 }) => ({ path, sha256 })),
  );
}
