import { open, rm, mkdtemp } from "node:fs/promises";
import { extname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

import { estimateBudget } from "@fuzit/budgeting";
import {
  createContextBundle,
  createFileContextItem,
  registerSecurityFilteredItem,
  selectDeltaScope,
  transformCodeContent,
  parseByteSize,
  splitPackedOutput,
  type SecurityFilteredItem,
} from "@fuzit/core";
import { markdownRenderer } from "@fuzit/renderer-markdown";
import { RendererRegistry } from "@fuzit/renderer-core";
import { jsonRenderer } from "@fuzit/renderer-json";
import { renderXml, xmlRenderer } from "@fuzit/renderer-xml";
import { textRenderer } from "@fuzit/renderer-text";
import {
  collectGitDiff,
  collectGitHistory,
  collectGitIdentity,
  collectGitStatus,
  runSafeRemoteGit,
} from "@fuzit/git";
import {
  computeSnapshotDelta,
  createSnapshot,
  readSnapshot,
} from "@fuzit/snapshots";
import {
  parseGitHubUrl,
  parseOwnerRepoHash,
  resolveBestGitHubCredential,
  githubRequest,
  normalizePrFile,
} from "@fuzit/provider-github";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

import {
  acquireRepository,
  analyzeRepository,
} from "../../application/repository.js";
import { copyToClipboard } from "../../output/clipboard.js";

interface PackDependencies {
  readonly currentDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function readStdinText(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function matchesPattern(path: string, pattern: string): boolean {
  const normalizedPath = path.toLowerCase();
  const normalizedPattern = pattern.toLowerCase().replace(/^\.\//, "");
  if (normalizedPattern.includes("*")) {
    const regex = new RegExp("^" + normalizedPattern.replace(/\*/g, ".*") + "$");
    return regex.test(normalizedPath);
  }
  return normalizedPath.includes(normalizedPattern);
}

export function resolvePackRenderer(
  renderers: RendererRegistry,
  format: string,
  output: string,
) {
  if (format === "auto") {
    if (output === "-") throw new Error("PACK.AUTO_REQUIRES_EXTENSION");
    const extension = extname(output).toLowerCase();
    const metadata = renderers
      .list()
      .find((candidate) => candidate.extension === extension);
    if (metadata === undefined) throw new Error("PACK.EXTENSION_UNKNOWN");
    return renderers.get(metadata.format);
  }
  const renderer = renderers.get(format);
  if (
    output !== "-" &&
    extname(output).toLowerCase() !== renderer.metadata.extension
  )
    throw new Error("PACK.EXTENSION_MISMATCH");
  if (output === "-" && renderer.metadata.capabilities.binary)
    throw new Error("PACK.BINARY_STDOUT_UNSUPPORTED");
  return renderer;
}

/**
 * Fetch PR changed files from GitHub API and produce SecurityFilteredItems
 * from the diff patches.
 */
async function acquirePrItems(
  prUrl: string,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<{ items: SecurityFilteredItem[]; prNumber: number; repo: string }> {
  const parsed = parseGitHubUrl(prUrl);
  if (!parsed.ok || parsed.ref.kind !== "github-pull-request") {
    throw new Error(`Not a valid PR URL: ${prUrl}`);
  }
  const prRef = parsed.ref;
  const credential = await resolveBestGitHubCredential({
    host: prRef.host.webHost,
    env: { ...environment },
  });
  const apiRoot = `https://${prRef.host.apiHost}`;
  const requestOptions = {
    credential,
    allowedHosts: [prRef.host.webHost, prRef.host.apiHost],
  };

  const filesResp = await githubRequest(
    `${apiRoot}/repos/${encodeURIComponent(prRef.owner)}/${encodeURIComponent(prRef.repo)}/pulls/${prRef.number}/files?per_page=100`,
    requestOptions,
  );
  if (!filesResp.ok || filesResp.status !== 200) {
    throw new Error(
      `GitHub PR files fetch failed (HTTP ${filesResp.ok ? filesResp.status : "network error"}).`,
    );
  }

  let rawFiles: unknown;
  try {
    rawFiles = JSON.parse(filesResp.body);
  } catch {
    throw new Error("GitHub returned malformed JSON for PR files.");
  }

  if (!Array.isArray(rawFiles)) {
    throw new Error("GitHub returned invalid PR file list.");
  }

  const items: SecurityFilteredItem[] = [];
  for (const rawFile of rawFiles) {
    const normalized = normalizePrFile(prRef, rawFile);
    const file = normalized.fileRecord;
    const patch = normalized.patchRecord;

    if (file.status === "removed") continue;

    const patchLines = patch ? patch.patchContent : "";
    const content = `# File: ${file.path}\n\n## Changes (+${file.additions}/-${file.deletions})\n\n\`\`\`diff\n${patchLines}\n\`\`\``;
    const sizeBytes = Buffer.byteLength(content, "utf8");
    const ext = file.path.includes(".") ? `.${file.path.split(".").pop() ?? ""}` : "";
    const sha256 = createHash("sha256").update(content).digest("hex");

    const item = createFileContextItem(
      {
        schemaVersion: 1,
        path: file.path,
        kind: "text",
        extension: ext,
        language: { name: inferLanguage(file.path), confidence: 0.8 },
        vendored: false,
        generated: false,
        symlink: false,
        readable: true,
        sizeBytes,
      },
      {
        status: "complete",
        content,
        sha256,
      },
    );
    items.push(
      registerSecurityFilteredItem({
        ...item,
        findings: [],
      } as unknown as SecurityFilteredItem),
    );
  }

  return { items, prNumber: prRef.number, repo: `${prRef.owner}/${prRef.repo}` };
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", java: "java", cs: "csharp",
    cpp: "cpp", c: "c", rb: "ruby", php: "php", swift: "swift",
    kt: "kotlin", md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
    toml: "toml", sh: "bash", bash: "bash", html: "html", css: "css",
    scss: "scss", sql: "sql",
  };
  return map[ext] ?? "text";
}

/**
 * Shallow-clone a remote GitHub repo into a temp directory, scan it, clean up.
 */
async function acquireRemoteRepoItems(
  repoUrl: string,
  environment: Readonly<Record<string, string | undefined>>,
  overrides?: { maxFiles?: number },
): Promise<ReturnType<typeof acquireRepository>> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed.ok || parsed.ref.kind !== "github-repository") {
    throw new Error(`Not a valid GitHub repository URL: ${repoUrl}`);
  }
  const repoRef = parsed.ref;
  const credential = await resolveBestGitHubCredential({
    host: repoRef.host.webHost,
    env: { ...environment },
  });

  // Build authenticated clone URL if possible
  let cloneUrl = `https://${repoRef.host.webHost}/${repoRef.owner}/${repoRef.repo}.git`;
  if (credential.isAuthenticated) {
    const authHeader = credential._getAuthorizationHeader();
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token) {
      cloneUrl = `https://x-access-token:${token}@${repoRef.host.webHost}/${repoRef.owner}/${repoRef.repo}.git`;
    }
  }

  const tempDir = await mkdtemp(join(tmpdir(), "fuzit-remote-"));
  try {
    const cloneArgs = [
      "clone", "--depth", "1", "--single-branch", "--no-tags",
      ...(repoRef.revision ? ["--branch", repoRef.revision] : []),
      cloneUrl, tempDir,
    ];
    const cloneResult = await runSafeRemoteGit(cloneArgs, {
      allowedHosts: [repoRef.host.webHost, repoRef.host.apiHost],
      credential,
      timeoutMs: 120_000,
    });
    if (!cloneResult.ok) {
      throw new Error(
        `Failed to clone remote repository: ${cloneResult.stderr || "unknown git error"}`,
      );
    }
    return await acquireRepository(tempDir, environment, overrides);
  } finally {
    try { await rm(tempDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

export function registerPackCommand(
  program: Command,
  dependencies: PackDependencies,
): void {
  const renderers = new RendererRegistry([
    jsonRenderer,
    markdownRenderer,
    textRenderer,
    xmlRenderer,
  ]);
  program
    .command("pack [source]")
    .description("create a local security-filtered context bundle")
    .option("--format <format>", "markdown, json, xml, text, or auto", "auto")
    .option("--output <path>", "output path or - for stdout", "fuzit-pack.md")
    .option("--root <path>", "repository root")
    .option("--remote <source>", "remote GitHub repository URL or OWNER/REPO")
    .option("--include <pattern>", "include path pattern", collect, [])
    .option("--ignore <pattern>", "ignore path pattern", collect, [])
    .option("--compress", "compress code to structural skeletons", false)
    .option("--remove-comments", "remove comments from source code", false)
    .option("--remove-empty-lines", "remove consecutive blank lines", false)
    .option("--line-numbers", "add line numbers to file contents", false)
    .option("--split-size <size>", "split output into chunks (e.g. 500kb, 1mb)")
    .option("--copy", "copy packed output to system clipboard", false)
    .option("--dry-run", "report selection without writing output")
    .option("--instruction <text>", "prepend system prompt or instructions to context bundle")
    .option("--config <path>", "custom configuration file path")
    .option("--max-files <count>", "override maximum file count limit", (val) => Number(val))
    .option("--git <mode>", "include current, history, or diff Git context")
    .option("--since <snapshot>", "include changes since an immutable snapshot")
    .option("-F, --full", "force full unlimited dump of all repository files", false)
    .option("--target <model>", "target AI model context window optimization (e.g. gpt-terra, gpt-sol, gemini-3.6, claude-fable, deepseek-r1)")
    .option("--task <intent>", "intent-based context retrieval for specific natural language tasks")
    .option("--diff", "pack only files changed in git diff", false)
    .option("--staged", "pack only staged git files", false)
    .option("--profile <profile>", "apply preset workflow profile (e.g. bug-fix, security-audit, code-review)")
    .option("--zip", "output compressed .zip context archive", false)
    .action(
      async (
        sourceArg: string | undefined,
        options: {
          format: string;
          output: string;
          root?: string;
          remote?: string;
          include: string[];
          ignore: string[];
          compress?: boolean;
          removeComments?: boolean;
          removeEmptyLines?: boolean;
          lineNumbers?: boolean;
          splitSize?: string;
          copy?: boolean;
          dryRun?: boolean;
          instruction?: string;
          config?: string;
          maxFiles?: number;
          git?: string;
          since?: string;
          full?: boolean;
          target?: string;
          task?: string;
          diff?: boolean;
          staged?: boolean;
          profile?: string;
          zip?: boolean;
        },
      ) => {
        let renderer;
        try {
          renderer = resolvePackRenderer(
            renderers,
            options.format,
            options.output,
          );
        } catch {
          dependencies.writeDiagnostic({
            schemaVersion: 1,
            code: "PACK.FORMAT_UNSUPPORTED",
            severity: "error",
            source: "pack",
            message: `Invalid format/output combination: ${options.format} (${renderers
              .list()
              .map(({ format }) => format)
              .join(", ")}).`,
          });
          dependencies.setExitCode(EXIT_CODES.validation);
          return;
        }

        const isStdin = options.root === "-" || sourceArg === "-";
        // Detect remote source from --remote flag OR positional URL argument
        const remoteSource =
          options.remote ??
          (sourceArg &&
          (sourceArg.startsWith("http://") || sourceArg.startsWith("https://"))
            ? sourceArg
            : undefined);

        const root = resolve(
          dependencies.currentDirectory,
          options.root ?? dependencies.currentDirectory,
        );

        let items: SecurityFilteredItem[] = [];
        let failedSources: string[] = [];
        let prPackMeta: { prNumber: number; repo: string } | undefined;
        const effectiveMaxFiles = options.full ? 999999 : options.maxFiles;

        if (isStdin) {
          // ── stdin mode ──────────────────────────────────────────────────
          const stdinText = await readStdinText();
          const item = createFileContextItem(
            {
              schemaVersion: 1,
              path: "stdin.txt",
              kind: "text",
              extension: "txt",
              language: { name: "text", confidence: 1.0 },
              vendored: false,
              generated: false,
              symlink: false,
              readable: true,
              sizeBytes: Buffer.byteLength(stdinText, "utf8"),
            },
            {
              status: "complete",
              content: stdinText,
              sha256: createHash("sha256").update(stdinText).digest("hex"),
            },
          );
          items = [registerSecurityFilteredItem({ ...item, findings: [] } as unknown as SecurityFilteredItem)];
        } else if (remoteSource) {
          // ── remote source mode ───────────────────────────────────────────
          const parsedRemote = parseGitHubUrl(remoteSource);

          if (parsedRemote.ok && parsedRemote.ref.kind === "github-pull-request") {
            // PR URL → pack the PR diff files
            try {
              const prResult = await acquirePrItems(remoteSource, dependencies.environment);
              items = prResult.items;
              prPackMeta = { prNumber: prResult.prNumber, repo: prResult.repo };
            } catch (error) {
              dependencies.writeDiagnostic(
                {
                  schemaVersion: 1,
                  code: "PACK.REMOTE_FETCH_FAILED",
                  severity: "error",
                  source: "pack",
                  message: `Failed to fetch PR from GitHub: ${error instanceof Error ? error.message : String(error)}`,
                },
                error,
              );
              dependencies.setExitCode(EXIT_CODES.environment);
              return;
            }
          } else if (parsedRemote.ok && parsedRemote.ref.kind === "github-repository") {
            // Repo URL → shallow clone and pack
            try {
              const remoteAcquisition = await acquireRemoteRepoItems(
                remoteSource,
                dependencies.environment,
                effectiveMaxFiles !== undefined ? { maxFiles: effectiveMaxFiles } : undefined,
              );
              items = [...remoteAcquisition.items];
              failedSources = remoteAcquisition.omissions
                .filter(({ failure }) => failure)
                .map(({ path, reason }) => `${path}: ${reason}`);
            } catch (error) {
              dependencies.writeDiagnostic(
                {
                  schemaVersion: 1,
                  code: "PACK.REMOTE_FETCH_FAILED",
                  severity: "error",
                  source: "pack",
                  message: `Failed to clone remote repository: ${error instanceof Error ? error.message : String(error)}`,
                },
                error,
              );
              dependencies.setExitCode(EXIT_CODES.environment);
              return;
            }
          } else {
            dependencies.writeDiagnostic({
              schemaVersion: 1,
              code: "PACK.REMOTE_UNSUPPORTED",
              severity: "error",
              source: "pack",
              message: `Unsupported remote source '${remoteSource}'. Provide a GitHub repository or PR URL.`,
            });
            dependencies.setExitCode(EXIT_CODES.validation);
            return;
          }
        } else {
          // ── local mode ──────────────────────────────────────────────────
          const acquisition = await acquireRepository(
            root,
            dependencies.environment,
            { ...(effectiveMaxFiles !== undefined ? { maxFiles: effectiveMaxFiles } : {}) },
          );
          items = [...acquisition.items];
          failedSources = acquisition.omissions
            .filter(({ failure }) => failure)
            .map(({ path, reason }) => `${path}: ${reason}`);
        }

        // Apply --diff or --staged filter (only meaningful for local repos)
        if ((options.diff || options.staged) && !remoteSource && !isStdin) {
          const status = await collectGitStatus(root);
          const changedPaths = new Set(status.map((s) => s.path));
          if (changedPaths.size > 0) {
            items = items.filter((item) => changedPaths.has(item.path));
          }
        }

        // Apply --task filter
        if (options.task) {
          const words = options.task.toLowerCase().split(/\s+/).filter(Boolean);
          items = items.filter((item) =>
            words.some(
              (w) =>
                item.path.toLowerCase().includes(w) ||
                (item.content && item.content.toLowerCase().includes(w)),
            ),
          );
        }

        // Apply --include and --ignore pattern filters
        if (options.include.length > 0) {
          items = items.filter((item) =>
            options.include.some((pattern) => matchesPattern(item.path, pattern)),
          );
        }
        if (options.ignore.length > 0) {
          items = items.filter(
            (item) =>
              !options.ignore.some((pattern) => matchesPattern(item.path, pattern)),
          );
        }

        // Apply transformations (compress, comments, empty lines, line numbers)
        const transformOptions = {
          ...(options.compress ? { compress: true } : {}),
          ...(options.removeComments ? { removeComments: true } : {}),
          ...(options.removeEmptyLines ? { removeEmptyLines: true } : {}),
          ...(options.lineNumbers ? { lineNumbers: true } : {}),
        };

        if (
          transformOptions.compress ||
          transformOptions.removeComments ||
          transformOptions.removeEmptyLines ||
          transformOptions.lineNumbers
        ) {
          items = items.map((item) => {
            if (!item.content) return item;
            const transformed = transformCodeContent(
              item.content,
              item.path,
              transformOptions,
            );
            return registerSecurityFilteredItem({
              ...item,
              content: transformed,
            });
          });
        }

        // For local mode, run full repo analysis; for remote use minimal stub
        const intelligence = (!remoteSource && !isStdin)
          ? analyzeRepository(await acquireRepository(root, dependencies.environment, { ...(effectiveMaxFiles !== undefined ? { maxFiles: effectiveMaxFiles } : {}) }))
          : { languages: [], packages: [], frameworks: [], tests: [], entryPoints: [], dependencies: [], conflicts: [], partial: false };

        const gitIdentity = (!remoteSource && !isStdin)
          ? await collectGitIdentity(root)
          : { head: null, dirty: false, available: false, remotes: [] };

        let deltaScope:
          ReturnType<typeof selectDeltaScope<SecurityFilteredItem>> | undefined;
        if (options.since !== undefined && !remoteSource && !isStdin) {
          const snapshotDirectory = resolve(
            dependencies.environment.FUZIT_CACHE_HOME ?? ".cache",
            "snapshots",
          );
          const baseline = await readSnapshot(snapshotDirectory, options.since);
          const current = createSnapshot({
            repositoryRevision: gitIdentity.head,
            dirty: gitIdentity.dirty,
            configHash: baseline.configHash,
            fileFingerprints: items.map((item) => ({
              path: item.path,
              sha256: item.sha256,
            })),
            bundleIdentityInputs: baseline.bundleIdentityInputs,
            complete: failedSources.length === 0,
            diagnostics: failedSources,
          });
          deltaScope = selectDeltaScope(
            items,
            computeSnapshotDelta(baseline, current),
          );
          items = [...deltaScope.included];
        }

        const estimate = estimateBudget(
          items.map((item) => item.content ?? "").join("\n"),
        );
        const gitContext =
          options.git === undefined || remoteSource || isStdin
            ? undefined
            : {
                identity: gitIdentity,
                changes: await collectGitStatus(root),
                history:
                  options.git === "history"
                    ? await collectGitHistory(root)
                    : [],
                diff:
                  options.git === "diff" ? await collectGitDiff(root) : null,
              };

        const bundle = createContextBundle({
          schemaVersion: 1,
          source: prPackMeta
            ? { kind: "repository", root: prPackMeta.repo }
            : { kind: "repository", root: remoteSource ?? "." },
          revision: gitIdentity.head,
          items: items.map((item) => ({
            id: item.id,
            path: item.path,
            sha256: item.sha256,
            contentStatus: item.contentStatus,
            redacted: item.findings.length > 0,
          })),
          redactionSummary: {
            findings: items.reduce(
              (sum, item) => sum + item.findings.length,
              0,
            ),
            redactedItems: items.filter((item) => item.findings.length > 0)
              .length,
            omittedItems: items.filter(
              (item) => item.contentStatus === "omitted",
            ).length,
          },
          warnings:
            failedSources.length > 0
              ? ["Pack completed partially."]
              : options.since === undefined
                ? []
                : [
                    `Baseline: ${options.since}`,
                    ...(deltaScope?.deleted.map(
                      ({ path }) => `Deleted since baseline: ${path}`,
                    ) ?? []),
                  ],
          failedSources,
          budget: {
            bytes: estimate.bytes,
            tokens: estimate.estimatedTokens,
            truncated: items.some((item) => item.contentStatus === "truncated"),
          },
          intelligence,
          ...(gitContext === undefined ? {} : { git: gitContext }),
          ...(options.instruction ? { instruction: options.instruction } : {}),
        });

        if (options.dryRun) {
          dependencies.writeData({
            schemaVersion: 1,
            selected: items.map((item) => item.path),
            redactions: bundle.redactionSummary,
            failedSources,
            ...(options.since === undefined
              ? {}
              : { baseline: options.since, deltaScope }),
            ...(prPackMeta ? { pr: prPackMeta } : {}),
          });
          dependencies.setExitCode(
            failedSources.length > 0 ? EXIT_CODES.partial : EXIT_CODES.success,
          );
          return;
        }

        const markdown = renderer.render(
          bundle,
          items,
          renderer.options.parse({}),
        );

        let copyStatus: string | undefined;
        if (options.copy) {
          const res = copyToClipboard(markdown);
          copyStatus = res.message;
        }

        if (options.output === "-") {
          dependencies.writeData(markdown);
        } else {
          let outputPath: string;
          try {
            outputPath = resolve(root, options.output);

            if (options.splitSize) {
              const maxBytes = parseByteSize(options.splitSize);
              const chunks = splitPackedOutput(markdown, outputPath, maxBytes);
              for (const chunk of chunks) {
                const handle = await open(chunk.path, "w");
                try {
                  await handle.writeFile(chunk.content, "utf8");
                } finally {
                  await handle.close();
                }
              }
            } else {
              const handle = await open(outputPath, "wx");
              try {
                await handle.writeFile(markdown, "utf8");
              } finally {
                await handle.close();
              }
            }
          } catch (error) {
            dependencies.writeDiagnostic(
              {
                schemaVersion: 1,
                code: "PACK.OUTPUT_WRITE_FAILED",
                severity: "error",
                source: "pack",
                message: "Output could not be created without overwriting.",
              },
              error,
            );
            dependencies.setExitCode(EXIT_CODES.environment);
            return;
          }

          dependencies.writeData({
            kind: "pack",
            output: outputPath,
            selected: items.map((item) => item.path),
            redactions: bundle.redactionSummary,
            ...(copyStatus ? { clipboard: copyStatus } : {}),
            ...(options.compress ? { compressed: true } : {}),
            ...(prPackMeta ? { pr: prPackMeta } : {}),
          });
        }

        dependencies.setExitCode(
          failedSources.length > 0 ? EXIT_CODES.partial : EXIT_CODES.success,
        );
      },
    );
}

export async function executeDualPack(
  root: string,
  environment: Readonly<Record<string, string | undefined>>,
  options: {
    compress?: boolean;
    removeComments?: boolean;
    removeEmptyLines?: boolean;
    lineNumbers?: boolean;
    instruction?: string;
  } = {},
): Promise<{
  kind: "dual-pack";
  outputs: string[];
  files: number;
  tokens: number;
}> {
  const acquisition = await acquireRepository(root, environment);
  let items = [...acquisition.items];
  const transformOptions = {
    ...(options.compress ? { compress: true } : {}),
    ...(options.removeComments ? { removeComments: true } : {}),
    ...(options.removeEmptyLines ? { removeEmptyLines: true } : {}),
    ...(options.lineNumbers ? { lineNumbers: true } : {}),
  };

  if (
    transformOptions.compress ||
    transformOptions.removeComments ||
    transformOptions.removeEmptyLines ||
    transformOptions.lineNumbers
  ) {
    items = items.map((item) => {
      if (!item.content) return item;
      const transformed = transformCodeContent(
        item.content,
        item.path,
        transformOptions,
      );
      return registerSecurityFilteredItem({
        ...item,
        content: transformed,
      });
    });
  }

  const intelligence = analyzeRepository(acquisition);
  const gitIdentity = await collectGitIdentity(root);
  const estimate = estimateBudget(items.map((i) => i.content ?? "").join("\n"));

  const bundle = createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: "." },
    revision: gitIdentity.head,
    items: items.map((item) => ({
      id: item.id,
      path: item.path,
      sha256: item.sha256,
      contentStatus: item.contentStatus,
      redacted: item.findings.length > 0,
    })),
    redactionSummary: {
      findings: items.reduce((sum, item) => sum + item.findings.length, 0),
      redactedItems: items.filter((item) => item.findings.length > 0).length,
      omittedItems: items.filter((item) => item.contentStatus === "omitted").length,
    },
    warnings: [],
    failedSources: [],
    budget: {
      bytes: estimate.bytes,
      tokens: estimate.estimatedTokens,
      truncated: items.some((item) => item.contentStatus === "truncated"),
    },
    intelligence,
    ...(options.instruction ? { instruction: options.instruction } : {}),
  });

  const mdContent = markdownRenderer.render(bundle, items, markdownRenderer.options.parse({}));
  const xmlContent = renderXml(bundle, items);

  const mdPath = resolve(root, "fuzit-pack.md");
  const xmlPath = resolve(root, "fuzit-pack.xml");

  const mdHandle = await open(mdPath, "w");
  try {
    await mdHandle.writeFile(mdContent, "utf8");
  } finally {
    await mdHandle.close();
  }

  const xmlHandle = await open(xmlPath, "w");
  try {
    await xmlHandle.writeFile(xmlContent, "utf8");
  } finally {
    await xmlHandle.close();
  }

  return {
    kind: "dual-pack",
    outputs: ["fuzit-pack.md", "fuzit-pack.xml"],
    files: items.length,
    tokens: bundle.budget.tokens,
  };
}

/**
 * Pack a PR's changed files — standalone function used by `fuzit pr pack`.
 */
export async function executePrPack(
  prUrl: string,
  environment: Readonly<Record<string, string | undefined>>,
  outputPath: string,
): Promise<{
  kind: "pr-pack";
  output: string;
  prNumber: number;
  repo: string;
  files: number;
  tokens: number;
}> {
  const renderer = markdownRenderer;
  const { items, prNumber, repo } = await acquirePrItems(prUrl, environment);
  const estimate = estimateBudget(items.map((i) => i.content ?? "").join("\n"));
  const bundle = createContextBundle({
    schemaVersion: 1,
    source: { kind: "repository", root: repo },
    revision: null,
    items: items.map((item) => ({
      id: item.id,
      path: item.path,
      sha256: item.sha256,
      contentStatus: item.contentStatus,
      redacted: false,
    })),
    redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
    warnings: [],
    failedSources: [],
    budget: {
      bytes: estimate.bytes,
      tokens: estimate.estimatedTokens,
      truncated: false,
    },
    intelligence: {
      languages: [], packages: [], frameworks: [], tests: [],
      entryPoints: [], dependencies: [], conflicts: [], partial: false,
    },
  });
  const mdContent = renderer.render(bundle, items, renderer.options.parse({}));
  const handle = await open(outputPath, "w");
  try {
    await handle.writeFile(mdContent, "utf8");
  } finally {
    await handle.close();
  }
  return { kind: "pr-pack", output: outputPath, prNumber, repo, files: items.length, tokens: bundle.budget.tokens };
}
