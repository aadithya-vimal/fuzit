import { runGit } from "../index.js";

export type GitChangeKind =
  | "staged"
  | "unstaged"
  | "untracked"
  | "deleted"
  | "renamed"
  | "conflict"
  | "submodule";

export interface GitChange {
  readonly path: string;
  readonly kind: GitChangeKind;
  readonly originalPath?: string;
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

export function parseGitStatus(output: string): GitChange[] {
  const fields = output.split("\0");
  const changes: GitChange[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field || field.length < 4) continue;
    const code = field.slice(0, 2);
    const path = normalize(field.slice(3));
    if (code === "!!") continue;
    if (code === "??") {
      changes.push({ path, kind: "untracked" });
      continue;
    }
    if (code.includes("S")) {
      changes.push({ path, kind: "submodule" });
      continue;
    }
    if (code.includes("U") || code === "AA" || code === "DD") {
      changes.push({ path, kind: "conflict" });
      continue;
    }
    if (code.includes("R")) {
      const originalPath = normalize(fields[index + 1] ?? "");
      index += 1;
      changes.push({ path, originalPath, kind: "renamed" });
      continue;
    }
    if (code.includes("D")) {
      changes.push({ path, kind: "deleted" });
      continue;
    }
    if (code[0] !== " ") changes.push({ path, kind: "staged" });
    if (code[1] !== " ") changes.push({ path, kind: "unstaged" });
  }
  return changes.sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
}

export async function collectGitStatus(cwd: string): Promise<GitChange[]> {
  const result = await runGit(
    ["status", "--porcelain=v1", "-z", "--ignored=no"],
    { cwd },
  );
  return result.ok ? parseGitStatus(result.stdout) : [];
}
