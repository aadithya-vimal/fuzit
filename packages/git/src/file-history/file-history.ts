import { runGit } from "../index.js";

export interface FileHistoryEntry {
  readonly hash: string;
  readonly timestamp: string;
  readonly subject: string;
}

export interface BlameLine {
  readonly line: number;
  readonly hash: string | null;
  readonly author: string | null;
  readonly timestamp: number | null;
  readonly content: string;
}

export function parseLineRange(value: string): { start: number; end: number } {
  const match = value.match(/^(\d+):(\d+)$/);
  if (!match) throw new TypeError("Line range must be start:end.");
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start < 1 || end < start || end - start + 1 > 500)
    throw new RangeError("Line range must contain 1 to 500 lines.");
  return { start, end };
}

export async function collectFileHistory(
  cwd: string,
  path: string,
  limit = 20,
): Promise<FileHistoryEntry[]> {
  const result = await runGit(
    [
      "log",
      "--follow",
      `-${Math.max(1, Math.min(limit, 100))}`,
      "--format=%H%x1f%aI%x1f%s",
      "--",
      path,
    ],
    { cwd, maximumBytes: 512 * 1024 },
  );
  if (!result.ok) return [];
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, timestamp, subject] = line.split("\u001f");
      return {
        hash: hash!,
        timestamp: timestamp!,
        subject: subject!.slice(0, 500),
      };
    });
}

export function parseBlame(output: string): BlameLine[] {
  const lines = output.split(/\r?\n/);
  const result: BlameLine[] = [];
  let hash: string | null = null;
  let line = 0;
  let author: string | null = null;
  let timestamp: number | null = null;
  for (const value of lines) {
    const header = value.match(/^([a-f0-9^]{40,64}) \d+ (\d+)/);
    if (header) {
      hash = header[1]!.startsWith("^") ? null : header[1]!;
      line = Number(header[2]);
    } else if (value.startsWith("author ")) author = value.slice(7);
    else if (value.startsWith("author-time "))
      timestamp = Number(value.slice(12));
    else if (value.startsWith("\t")) {
      result.push({ line, hash, author, timestamp, content: value.slice(1) });
      author = null;
      timestamp = null;
    }
  }
  return result;
}

export async function collectBlame(
  cwd: string,
  path: string,
  range: string,
): Promise<BlameLine[]> {
  const { start, end } = parseLineRange(range);
  const result = await runGit(
    ["blame", "--line-porcelain", "-L", `${start},${end}`, "--", path],
    { cwd, maximumBytes: 2 * 1024 * 1024 },
  );
  return result.ok ? parseBlame(result.stdout) : [];
}
