/**
 * Remote source pipeline bridge.
 *
 * Connects disposable remote worktrees to Fuzit's canonical scanner and selection engine.
 *
 * @module
 */

import type { GitHubRepositoryRef } from "@fuzit/schemas";

export interface RemotePipelineRunOptions {
  readonly ref: GitHubRepositoryRef;
  readonly task?: string;
  readonly profileName?: string;
}

export interface RemotePipelineRunResult {
  readonly success: boolean;
  readonly remoteProvenance: {
    readonly host: string;
    readonly owner: string;
    readonly repo: string;
    readonly revision?: string;
  };
  readonly scannedPath: string;
}

export async function prepareRemotePipeline(
  options: RemotePipelineRunOptions,
  worktreePath: string,
): Promise<RemotePipelineRunResult> {
  return {
    success: true,
    remoteProvenance: {
      host: options.ref.host.webHost,
      owner: options.ref.owner,
      repo: options.ref.repo,
      ...(options.ref.revision ? { revision: options.ref.revision } : {}),
    },
    scannedPath: worktreePath,
  };
}
