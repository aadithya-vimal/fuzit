/**
 * Safe remote Git transport adapter.
 *
 * Provides argument-array based Git operations with disabled prompts, hooks,
 * submodules, LFS filters, and global/system Git configuration dependence.
 *
 * @module
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CredentialHandle } from "@fuzit/provider-github";

const execFileAsync = promisify(execFile);

export interface SafeRemoteGitOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly credential?: CredentialHandle;
  readonly allowedHosts: readonly string[];
}

export interface SafeRemoteGitResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export function buildSafeGitEnv(
  credential?: CredentialHandle,
): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env["PATH"] ?? "",
    SYSTEMROOT: process.env["SYSTEMROOT"] ?? "",
    HOME: process.env["HOME"] ?? process.env["USERPROFILE"] ?? "",
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "echo",
    SSH_ASKPASS: "echo",
    GIT_CONFIG_NOGLOBAL: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ALLOW_PROTOCOL: "https",
    GIT_LFS_SKIP_SMUDGE: "1",
  };

  if (credential && credential.isAuthenticated) {
    const authHeader = credential._getAuthorizationHeader();
    if (authHeader) {
      env["GIT_HTTP_HEADER"] = `Authorization: ${authHeader}`;
    }
  }

  return env;
}

export async function runSafeRemoteGit(
  args: readonly string[],
  options: SafeRemoteGitOptions,
): Promise<SafeRemoteGitResult> {
  const timeout = options.timeoutMs ?? 60_000;
  const env = buildSafeGitEnv(options.credential);

  const safeArgs = [
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "filter.lfs.smudge=",
    "-c",
    "filter.lfs.clean=",
    "-c",
    "filter.lfs.process=",
    "-c",
    "filter.lfs.required=false",
    ...args,
  ];

  try {
    const { stdout, stderr } = await execFileAsync("git", safeArgs, {
      cwd: options.cwd,
      env,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr: sanitizeGitStderr(stderr), exitCode: 0 };
  } catch (error: unknown) {
    const err = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: number;
    };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: sanitizeGitStderr(
        err.stderr ?? err.message ?? "Git process error",
      ),
      exitCode: err.code ?? 1,
    };
  }
}

function sanitizeGitStderr(stderr: string): string {
  return stderr.replace(
    /Authorization:\s*Bearer\s+\S+/gi,
    "Authorization: Bearer [REDACTED]",
  );
}
