import { gitIdentitySchema, type GitIdentity } from "@fuzit/schemas";

import { runGit, type GitProcessResult } from "../index.js";

type Runner = (
  arguments_: readonly string[],
  options?: { readonly cwd?: string },
) => Promise<GitProcessResult>;

function sanitizeRemote(url: string): string {
  return url.replace(/:\/\/[^/\s:@]+:[^/\s@]+@/g, "://[REDACTED]@");
}

export async function collectGitIdentity(
  cwd: string,
  runner: Runner = runGit,
): Promise<GitIdentity> {
  const root = await runner(["rev-parse", "--show-toplevel"], { cwd });
  if (!root.ok)
    return gitIdentitySchema.parse({
      schemaVersion: 1,
      available: false,
      root: null,
      head: null,
      branch: null,
      detached: false,
      dirty: false,
      remotes: [],
    });
  const [head, branch, status, remotes] = await Promise.all([
    runner(["rev-parse", "--verify", "HEAD"], { cwd }),
    runner(["symbolic-ref", "--short", "-q", "HEAD"], { cwd }),
    runner(["status", "--porcelain=v1", "--untracked-files=normal"], { cwd }),
    runner(["remote", "-v"], { cwd }),
  ]);
  const remoteMap = new Map<string, string>();
  for (const line of remotes.stdout.split(/\r?\n/)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
    if (match) remoteMap.set(match[1]!, sanitizeRemote(match[2]!));
  }
  return gitIdentitySchema.parse({
    schemaVersion: 1,
    available: true,
    root: root.stdout.trim(),
    head: head.ok ? head.stdout.trim() : null,
    branch: branch.ok ? branch.stdout.trim() : null,
    detached: head.ok && !branch.ok,
    dirty: status.ok && status.stdout.length > 0,
    remotes: [...remoteMap].map(([name, url]) => ({ name, url })),
  });
}
