/**
 * Local remote inference service.
 *
 * Infers owner/repository from local git clone origin remotes.
 *
 * @module
 */

export function inferRemoteFromGitConfig(
  remotes: readonly { name: string; url: string }[],
): { owner: string; repo: string } | null {
  const origin = remotes.find((r) => r.name === "origin") ?? remotes[0];
  if (!origin) return null;

  const match = origin.url.match(
    /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i,
  );
  if (!match || !match[1] || !match[2]) return null;

  return { owner: match[1], repo: match[2] };
}
