import { open } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { estimateBudget } from "@fuzit/budgeting";
import {
  createContextBundle,
  selectDeltaScope,
  type SecurityFilteredItem,
} from "@fuzit/core";
import { markdownRenderer } from "@fuzit/renderer-markdown";
import { RendererRegistry } from "@fuzit/renderer-core";
import { jsonRenderer } from "@fuzit/renderer-json";
import { xmlRenderer } from "@fuzit/renderer-xml";
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
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

import {
  acquireRepository,
  analyzeRepository,
} from "../../application/repository.js";

interface PackDependencies {
  readonly currentDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
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
    .command("pack")
    .description("create a local security-filtered context bundle")
    .option("--format <format>", "markdown, json, xml, text, or auto", "auto")
    .requiredOption("--output <path>", "output path or - for stdout")
    .option("--root <path>", "repository root")
    .option("--dry-run", "report selection without writing output")
    .option("--git <mode>", "include current, history, or diff Git context")
    .option("--since <snapshot>", "include changes since an immutable snapshot")
    .action(
      async (options: {
        format: string;
        output: string;
        root?: string;
        dryRun?: boolean;
        git?: string;
        since?: string;
      }) => {
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

        const root = resolve(
          dependencies.currentDirectory,
          options.root ?? dependencies.currentDirectory,
        );
        const acquisition = await acquireRepository(
          root,
          dependencies.environment,
        );
        let items: SecurityFilteredItem[] = [...acquisition.items];
        const failedSources = acquisition.omissions
          .filter(({ failure }) => failure)
          .map(({ path, reason }) => `${path}: ${reason}`);
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
        if (options.output === "-") {
          dependencies.writeData(markdown);
        } else {
          let outputPath: string;
          try {
            outputPath = resolve(root, options.output);
            const handle = await open(outputPath, "wx");
            try {
              await handle.writeFile(markdown, "utf8");
            } finally {
              await handle.close();
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
          });
        }
        dependencies.setExitCode(
          failedSources.length > 0 ? EXIT_CODES.partial : EXIT_CODES.success,
        );
      },
    );
}
