import { resolve } from "node:path";
import {
  createIndexIdentitySet,
  createRepositoryId,
  getLocalIndexPath,
  openLocalIndex,
  readLocalIndexSemanticState,
  writeLocalIndexSemanticState,
  type LocalIndexSemanticState,
} from "@fuzit/index";
import {
  LOCAL_INDEX_SCHEMA_VERSION,
  type Diagnostic,
  type ExitCode,
} from "@fuzit/schemas";
import { WatcherDaemon } from "@fuzit/watcher";
import { Command } from "commander";
import {
  acquireRepository,
  acquisitionContentHash,
  repositoryIdentity,
} from "../../application/repository.js";

const versions = {
  scannerVersion: "1",
  parserVersion: "1",
  securityPolicyVersion: "1",
  schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
} as const;

const componentIdentities = {
  parser: { name: "fuzit-built-in-parsers", version: versions.parserVersion },
  analysis: { name: "fuzit-analysis", version: "1" },
  graph: { name: "fuzit-context-graph", schemaVersion: 1 },
  schema: { name: "fuzit-incremental-index", schemaVersion: 1 },
  securityPolicy: {
    name: "fuzit-security-policy",
    version: versions.securityPolicyVersion,
  },
} as const;

interface WatchCommandDependencies {
  readonly writeData: (value: unknown) => void;
  readonly writeDiagnostic: (diagnostic: Diagnostic, cause?: unknown) => void;
  readonly setExitCode: (exitCode: ExitCode) => void;
}

export function registerWatchCommand(
  program: Command,
  dependencies: WatchCommandDependencies,
): void {
  program
    .command("watch")
    .description("Watch repository for changes and update local index")
    .option("--root <path>", "Repository root path", ".")
    .option("--debounce-ms <ms>", "Debounce window in milliseconds", "100")
    .option("--json", "Emit status in machine-readable JSON format", false)
    .option("--quiet", "Suppress non-essential log output", false)
    .option("--once", "Process one update batch and exit immediately", false)
    .option("--foreground", "Run in foreground process", false)
    .option("--no-initial-scan", "Skip initial repository scan", false)
    .option("--reconcile", "Trigger explicit canonical reconciliation", false)
    .option("--status", "Report current watch status and exit", false)
    .action(async (options) => {
      const repositoryRoot = resolve(options.root);
      const identity = await repositoryIdentity(repositoryRoot);
      const repoId = createRepositoryId(identity.fingerprint);

      const cacheHome = resolve(
        process.env.FUZIT_CACHE_HOME ?? process.env.LOCALAPPDATA ?? ".cache",
      );

      const indexPath = getLocalIndexPath({
        cacheHome,
        repositoryFingerprint: identity.fingerprint,
      });

      await openLocalIndex(indexPath, repoId);

      let semanticState: LocalIndexSemanticState | undefined =
        await readLocalIndexSemanticState(indexPath);

      if (!semanticState) {
        const acquisition = await acquireRepository(
          repositoryRoot,
          process.env,
        );
        const contentHash = acquisitionContentHash(acquisition);

        semanticState = {
          ...versions,
          contentHash,
          configHash: acquisition.configHash,
          identities: createIndexIdentitySet({
            effectiveConfiguration: acquisition.configHash,
            ignorePolicy: acquisition.configHash,
            securityPolicy: componentIdentities.securityPolicy,
            parser: componentIdentities.parser,
            analysis: componentIdentities.analysis,
            graph: componentIdentities.graph,
            schema: componentIdentities.schema,
          }),
        };
        await writeLocalIndexSemanticState(indexPath, semanticState);
      }

      const daemon = new WatcherDaemon({
        repositoryRoot,
        indexPath,
        repositoryId: repoId,
        semanticState,
        debounceMs: parseInt(options.debounceMs, 10),
      });

      if (options.status) {
        dependencies.writeData(daemon.status);
        return;
      }

      await daemon.start();

      if (options.once) {
        await daemon.processPendingBatch("batch-cli-once");
        await daemon.stop();
        dependencies.writeData({ status: "complete", mode: "once" });
        return;
      }

      if (options.foreground) {
        if (!options.quiet) {
          dependencies.writeData(
            `Watching repository in foreground: ${repositoryRoot}\n`,
          );
        }
        await new Promise<void>((resolveSignal) => {
          const shutdown = async () => {
            await daemon.stop();
            resolveSignal();
          };
          process.once("SIGINT", shutdown);
          process.once("SIGTERM", shutdown);
        });
      } else {
        await daemon.stop();
      }
    });
}
