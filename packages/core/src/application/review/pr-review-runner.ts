/**
 * Flagship read-only PR review command service.
 *
 * @module
 */

import {
  githubRequest,
  normalizePrFile,
  normalizePullRequestData,
  resolveBestGitHubCredential,
  type FixtureTransport,
} from "@fuzit/provider-github";
import type {
  GitHubPullRequestRef,
  PullRequestFileRecord,
} from "@fuzit/schemas";

export interface ReviewRunOptions {
  readonly prRef: GitHubPullRequestRef;
  readonly task?: string;
  readonly profileName?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fixtureTransport?: FixtureTransport;
}

export interface ReviewRunResult {
  readonly ok: boolean;
  readonly prNumber: number;
  readonly targetRepo: string;
  readonly summary: string;
  readonly title: string;
  readonly state: string;
  readonly author: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly files: readonly PullRequestFileRecord[];
  readonly patches: readonly {
    path: string;
    content: string;
    truncated: boolean;
  }[];
  readonly findings: readonly string[];
}

export async function runPrReview(
  options: ReviewRunOptions,
): Promise<ReviewRunResult> {
  const { prRef } = options;
  const credential = await resolveBestGitHubCredential({
    host: prRef.host.webHost,
    env: { ...(options.environment ?? process.env) },
  });
  const apiRoot = `https://${prRef.host.apiHost}`;
  const requestOptions = {
    credential,
    allowedHosts: [prRef.host.webHost, prRef.host.apiHost],
    ...(options.fixtureTransport
      ? { fixtureTransport: options.fixtureTransport }
      : {}),
  };
  const metadataResponse = await githubRequest(
    `${apiRoot}/repos/${encodeURIComponent(prRef.owner)}/${encodeURIComponent(prRef.repo)}/pulls/${prRef.number}`,
    requestOptions,
  );
  if (!metadataResponse.ok) {
    if (metadataResponse.kind === "rate-limited") {
      throw new Error(
        `GitHub rate limited the request. Retry after ${metadataResponse.retryAfterSeconds ?? "a short delay"} seconds.`,
      );
    }
    if (metadataResponse.kind === "network-error") {
      throw new Error(`GitHub network failure: ${metadataResponse.diagnostic}`);
    }
    throw new Error(
      credential.isAuthenticated
        ? "GitHub resource not accessible with the current credentials (HTTP 404)."
        : "GitHub resource not found or not accessible anonymously (HTTP 404).",
    );
  }
  if (metadataResponse.status === 401)
    throw new Error("GitHub credentials are invalid or expired.");
  if (metadataResponse.status === 403)
    throw new Error(
      credential.isAuthenticated
        ? "GitHub access is forbidden for the authenticated account."
        : "GitHub authentication required or access forbidden.",
    );
  if (metadataResponse.status === 404)
    throw new Error(
      credential.isAuthenticated
        ? "GitHub resource not accessible with the current credentials (HTTP 404)."
        : "GitHub resource not found or not accessible anonymously (HTTP 404).",
    );
  if (metadataResponse.status !== 200)
    throw new Error(`GitHub PR acquisition failed (HTTP ${metadataResponse.status}).`);
  const filesResponse = await githubRequest(
    `${apiRoot}/repos/${encodeURIComponent(prRef.owner)}/${encodeURIComponent(prRef.repo)}/pulls/${prRef.number}/files?per_page=100`,
    requestOptions,
  );
  if (!filesResponse.ok) {
    throw new Error(
      filesResponse.kind === "rate-limited"
        ? `GitHub rate limited the file request. Retry after ${filesResponse.retryAfterSeconds ?? "a short delay"} seconds.`
        : `GitHub PR files acquisition failed: ${filesResponse.diagnostic}`,
    );
  }
  if (filesResponse.status === 401)
    throw new Error("GitHub credentials are invalid or expired.");
  if (filesResponse.status === 403)
    throw new Error("GitHub access is forbidden for the authenticated account.");
  if (filesResponse.status === 404)
    throw new Error("GitHub resource not accessible with the current credentials.");
  if (filesResponse.status !== 200)
    throw new Error(`GitHub PR files acquisition failed (HTTP ${filesResponse.status}).`);

  let rawMetadata: unknown;
  let rawFiles: unknown;
  try {
    rawMetadata = JSON.parse(metadataResponse.body);
    rawFiles = JSON.parse(filesResponse.body);
  } catch {
    throw new Error(
      "GitHub returned malformed JSON while acquiring the pull request.",
    );
  }
  if (!Array.isArray(rawFiles))
    throw new Error("GitHub returned an invalid pull-request file list.");
  const metadata = normalizePullRequestData(prRef, rawMetadata);
  const normalized = rawFiles.map((file) => normalizePrFile(prRef, file));
  const files = normalized.map(({ fileRecord }) => fileRecord);
  const patches = normalized.flatMap(({ patchRecord }) =>
    patchRecord
      ? [
          {
            path: patchRecord.path,
            content: patchRecord.patchContent,
            truncated: patchRecord.isTruncated,
          },
        ]
      : [],
  );
  const findings: string[] = [];
  for (const patch of patches) {
    if (/^\+.*(?:password|secret|api[_-]?key)\s*[:=]/im.test(patch.content))
      findings.push(
        `${patch.path}: added text resembles a hard-coded credential; verify and remove it.`,
      );
    if (/^\+.*(?:eval\(|child_process|shell\s*:\s*true)/im.test(patch.content))
      findings.push(
        `${patch.path}: added code uses a high-risk execution primitive; review input handling.`,
      );
  }
  const summary = [
    `# Pull request #${prRef.number}: ${metadata.title}`,
    "",
    `Repository: ${metadata.repositoryFullName}`,
    `State: ${metadata.state}${metadata.isDraft ? " (draft)" : ""}`,
    `Author: ${metadata.authorLogin}`,
    `Change: ${metadata.baseRef} <- ${metadata.headRef}`,
    `Changed files: ${files.length}`,
    "",
    "## Files",
    ...(files.length === 0
      ? ["No changed files were reported by GitHub."]
      : files.map(
          (file) =>
            `- ${file.status}: ${file.path} (+${file.additions}/-${file.deletions})`,
        )),
    "",
    "## Findings",
    ...(findings.length === 0
      ? [
          "No high-confidence findings were detected by the bounded automated patch inspection.",
        ]
      : findings.map((finding) => `- ${finding}`)),
    ...(patches.some(({ truncated }) => truncated)
      ? ["", "Note: one or more patches were truncated at the safety limit."]
      : []),
  ].join("\n");
  return {
    ok: true,
    prNumber: prRef.number,
    targetRepo: `${prRef.owner}/${prRef.repo}`,
    summary,
    title: metadata.title,
    state: metadata.state,
    author: metadata.authorLogin,
    baseRef: metadata.baseRef,
    headRef: metadata.headRef,
    files,
    patches,
    findings,
  };
}
