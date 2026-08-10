import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createIndexIdentitySet,
  createRepositoryId,
  evaluateInvalidation,
  getLocalIndexPath,
  getLocalIndexStatus,
  inspectLocalIndex,
  openLocalIndex,
  readLocalIndexSemanticState,
  verifyLocalIndex,
  writeLocalIndexSemanticState,
  type LocalIndexSemanticState,
} from "@fuzit/index";
import { LOCAL_INDEX_SCHEMA_VERSION } from "@fuzit/schemas";
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

export function registerCacheCommand(
  program: Command,
  runtime: {
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly writeData: (value: unknown) => void;
  },
): void {
  const cache = program.command("cache").description("Manage the local index.");
  const location = async (root: string) => {
    const repositoryRoot = resolve(root);
    const cacheHome = resolve(
      runtime.environment.FUZIT_CACHE_HOME ??
        runtime.environment.LOCALAPPDATA ??
        ".cache",
    );
    const identity = await repositoryIdentity(repositoryRoot);
    return {
      path: getLocalIndexPath({
        cacheHome,
        repositoryFingerprint: identity.fingerprint,
      }),
      repositoryId: createRepositoryId(identity.fingerprint),
      fingerprint: identity.fingerprint,
      cacheHome,
      repositoryRoot,
    };
  };
  const currentState = async (
    root: string,
  ): Promise<LocalIndexSemanticState> => {
    const acquisition = await acquireRepository(root, runtime.environment);
    return {
      ...versions,
      contentHash: acquisitionContentHash(acquisition),
      configHash: acquisition.configHash,
      identities: createIndexIdentitySet({
        effectiveConfiguration: acquisition.configHash,
        ignorePolicy: {
          configuration: acquisition.configHash,
          precedence: "hard-cli-project-fuzitignore-gitignore-defaults",
        },
        ...componentIdentities,
      }),
    };
  };

  cache
    .command("init")
    .requiredOption("--root <path>", "repository root")
    .action(async ({ root }: { root: string }) => {
      const value = await location(root);
      const store = await openLocalIndex(value.path, value.repositoryId);
      await writeLocalIndexSemanticState(
        value.path,
        await currentState(value.repositoryRoot),
      );
      runtime.writeData({
        path: store.directory,
        repositoryId: value.repositoryId,
        schemaVersion: store.metadata.schemaVersion,
        state: "ready",
      });
    });

  cache
    .command("status")
    .requiredOption("--root <path>")
    .option("--json")
    .action(async ({ root }: { root: string }) => {
      const value = await location(root);
      const observed = await inspectLocalIndex(value.path, value.repositoryId);
      const stored = await readLocalIndexSemanticState(value.path);
      runtime.writeData({
        ...getLocalIndexStatus(
          {
            cacheHome: value.cacheHome,
            repositoryFingerprint: value.fingerprint,
          },
          observed,
        ),
        identities: stored?.identities ?? null,
      });
    });

  cache
    .command("rebuild")
    .requiredOption("--root <path>")
    .option("--dry-run")
    .action(async ({ root, dryRun }: { root: string; dryRun?: boolean }) => {
      const value = await location(root);
      const current = await currentState(value.repositoryRoot);
      const stored = await readLocalIndexSemanticState(value.path);
      const decision =
        stored === undefined
          ? {
              valid: false,
              reasons: ["index semantic state absent"],
              action: "rebuild" as const,
              affectedRecordTypes: ["file", "analysis", "graph"] as const,
            }
          : evaluateInvalidation(stored, current);
      if (!dryRun && decision.action === "rebuild") {
        await openLocalIndex(value.path, value.repositoryId);
        await writeLocalIndexSemanticState(value.path, current);
      }
      runtime.writeData({
        path: value.path,
        dryRun: dryRun === true,
        decision,
      });
    });

  cache
    .command("verify")
    .requiredOption("--root <path>")
    .action(async ({ root }: { root: string }) => {
      const value = await location(root);
      const current = await currentState(value.repositoryRoot);
      const result = await verifyLocalIndex({
        indexPath: value.path,
        expectedRepositoryId: value.repositoryId,
        currentSemanticState: current,
      });
      runtime.writeData({
        schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
        repositoryId: value.repositoryId,
        path: value.path,
        state: result.status,
        valid: result.valid,
        rebuildRequired: result.rebuildRequired,
        reasons: result.reasons,
        details: result.details,
      });
    });

  cache
    .command("purge")
    .requiredOption("--root <path>")
    .option("--dry-run")
    .action(async ({ root, dryRun }: { root: string; dryRun?: boolean }) => {
      const value = await location(root);
      if (!dryRun) await rm(value.path, { recursive: true, force: true });
      runtime.writeData({
        path: value.path,
        dryRun: dryRun === true,
        action: dryRun
          ? "would purge exact Fuzit-owned index directory"
          : "purged exact Fuzit-owned index directory",
      });
    });
}
