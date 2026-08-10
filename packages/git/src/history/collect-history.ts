import { createHash } from "node:crypto";

import { runGit } from "../index.js";

export interface GitHistoryEntry {
  readonly hash: string;
  readonly parents: readonly string[];
  readonly authorName: string;
  readonly authorEmail: string | null;
  readonly timestamp: string;
  readonly subject: string;
  readonly changedPaths: readonly string[];
}

export type AuthorEmailPolicy = "omit" | "hash";

export function parseGitHistory(
  output: string,
  emailPolicy: AuthorEmailPolicy = "omit",
): GitHistoryEntry[] {
  return output
    .split("\u001e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [header, ...pathLines] = record.split(/\r?\n/);
      const [hash, parents, authorName, authorEmail, timestamp, subject] =
        header!.split("\u001f");
      return {
        hash: hash!,
        parents: parents ? parents.split(" ").filter(Boolean) : [],
        authorName: authorName!,
        authorEmail:
          emailPolicy === "hash"
            ? createHash("sha256").update(authorEmail!, "utf8").digest("hex")
            : null,
        timestamp: timestamp!,
        subject: (subject ?? "").slice(0, 500),
        changedPaths: pathLines
          .map((path) => path.trim().replaceAll("\\", "/"))
          .filter(Boolean)
          .sort(),
      };
    });
}

export async function collectGitHistory(
  cwd: string,
  options: {
    readonly limit?: number;
    readonly emailPolicy?: AuthorEmailPolicy;
  } = {},
): Promise<GitHistoryEntry[]> {
  const limit = Math.max(0, Math.min(options.limit ?? 20, 100));
  if (limit === 0) return [];
  const result = await runGit(
    [
      "log",
      `-${limit}`,
      "--no-decorate",
      "--date=iso-strict",
      "--format=%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s",
      "--name-only",
    ],
    { cwd, maximumBytes: 2 * 1024 * 1024 },
  );
  return result.ok ? parseGitHistory(result.stdout, options.emailPolicy) : [];
}
