/**
 * Direct issue-context workflow runner.
 *
 * @module
 */

import {
  githubRequest,
  normalizeIssue,
  normalizeIssueComment,
  resolveCredential,
  type FixtureTransport,
} from "@fuzit/provider-github";
import type { GitHubIssueRef, IssueCommentRecord } from "@fuzit/schemas";

export interface IssueRunOptions {
  readonly issueRef: GitHubIssueRef;
  readonly profileName?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fixtureTransport?: FixtureTransport;
}

export interface IssueRunResult {
  readonly ok: boolean;
  readonly issueNumber: number;
  readonly targetRepo: string;
  readonly summary: string;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly author: string;
  readonly comments: readonly IssueCommentRecord[];
}

export async function runIssueContext(
  options: IssueRunOptions,
): Promise<IssueRunResult> {
  const { issueRef } = options;
  const credential = resolveCredential({
    host: issueRef.host.webHost,
    env: { ...(options.environment ?? process.env) },
  });
  const apiRoot = `https://${issueRef.host.apiHost}`;
  const requestOptions = {
    credential,
    allowedHosts: [issueRef.host.webHost, issueRef.host.apiHost],
    ...(options.fixtureTransport
      ? { fixtureTransport: options.fixtureTransport }
      : {}),
  };
  const baseUrl = `${apiRoot}/repos/${encodeURIComponent(issueRef.owner)}/${encodeURIComponent(issueRef.repo)}/issues/${issueRef.number}`;
  const [issueResponse, commentsResponse] = await Promise.all([
    githubRequest(baseUrl, requestOptions),
    githubRequest(`${baseUrl}/comments?per_page=100`, requestOptions),
  ]);
  if (!issueResponse.ok)
    throw new Error(
      `GitHub issue acquisition failed: ${issueResponse.diagnostic}`,
    );
  if (issueResponse.status !== 200)
    throw new Error(
      `GitHub issue acquisition failed (HTTP ${issueResponse.status}). Check the issue number and repository access.`,
    );
  if (!commentsResponse.ok)
    throw new Error(
      `GitHub issue comments acquisition failed: ${commentsResponse.diagnostic}`,
    );
  if (commentsResponse.status !== 200)
    throw new Error(
      `GitHub issue comments acquisition failed (HTTP ${commentsResponse.status}).`,
    );
  let rawIssue: unknown;
  let rawComments: unknown;
  try {
    rawIssue = JSON.parse(issueResponse.body);
    rawComments = JSON.parse(commentsResponse.body);
  } catch {
    throw new Error(
      "GitHub returned malformed JSON while acquiring the issue.",
    );
  }
  if (!Array.isArray(rawComments))
    throw new Error("GitHub returned an invalid issue comment list.");
  const issue = normalizeIssue(issueRef, rawIssue);
  const comments = rawComments.map((comment) =>
    normalizeIssueComment(issueRef, comment),
  );
  const summary = [
    `# Issue #${issueRef.number}: ${issue.title}`,
    "",
    `Repository: ${issue.repositoryFullName}`,
    `State: ${issue.state}`,
    `Author: ${issue.authorLogin}`,
    `Labels: ${issue.labels.join(", ") || "none"}`,
    "",
    "## Description",
    issue.body || "No description was provided.",
    "",
    `## Comments (${comments.length})`,
    ...(comments.length === 0
      ? ["No comments."]
      : comments.map(
          (comment) => `### ${comment.authorLogin}\n\n${comment.body}`,
        )),
  ].join("\n");
  return {
    ok: true,
    issueNumber: issueRef.number,
    targetRepo: `${issueRef.owner}/${issueRef.repo}`,
    summary,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    author: issue.authorLogin,
    comments,
  };
}
