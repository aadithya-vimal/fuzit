import { open, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

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
} from "@fuzit/git";
import {
  computeSnapshotDelta,
  createSnapshot,
  readSnapshot,
} from "@fuzit/snapshots";
import { parseGitHubUrl, parseOwnerRepoHash } from "@fuzit/provider-github";
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
        const remoteSource = options.remote ?? (sourceArg && (sourceArg.startsWith("http://") || sourceArg.startsWith("https://") || sourceArg.includes("/")) ? sourceArg : undefined);

        const root = resolve(
          dependencies.currentDirectory,
          options.root ?? dependencies.currentDirectory,
        );

        let items: SecurityFilteredItem[] = [];
        let failedSources: string[] = [];
        const effectiveMaxFiles = options.full ? 999999 : options.maxFiles;
        const acquisition = await acquireRepository(
          root,
          dependencies.environment,
          { ...(effectiveMaxFiles !== undefined ? { maxFiles: effectiveMaxFiles } : {}) },
        );

        if (isStdin) {
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
              sha256: "sha256:stdin",
            },
          );
          items = [registerSecurityFilteredItem({ ...item, findings: [] } as unknown as SecurityFilteredItem)];
        } else {
          items = [...acquisition.items];
          failedSources = acquisition.omissions
            .filter(({ failure }) => failure)
            .map(({ path, reason }) => `${path}: ${reason}`);
        }

        // Apply --diff or --staged filter
        if (options.diff || options.staged) {
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

        const intelligence = analyzeRepository(acquisition);

        const gitIdentity = await collectGitIdentity(root);
        let deltaScope:
          ReturnType<typeof selectDeltaScope<SecurityFilteredItem>> | undefined;
        if (options.since !== undefined) {
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
          options.git === undefined
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
  const xmlContent = renderXml(bundle);

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
