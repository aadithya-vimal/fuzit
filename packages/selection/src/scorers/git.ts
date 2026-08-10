export interface GitChangeEvidence {
  readonly revision: string;
  readonly paths: readonly string[];
  readonly previousPaths?: Readonly<Record<string, string>>;
}

export interface GitScoreInput {
  readonly path: string;
  readonly dirtyPaths: readonly string[];
  readonly recentPaths?: readonly string[];
  readonly historyAvailable: boolean;
  readonly history?: readonly GitChangeEvidence[];
  readonly taskPaths?: readonly string[];
  readonly maximumCommits?: number;
}

export interface GitScoreContribution {
  readonly source:
    | "git-dirty"
    | "git-recency"
    | "git-frequency"
    | "git-co-change"
    | "git-task-diff";
  readonly value: number;
  readonly reason: string;
  readonly evidence: readonly string[];
}

const canonical = (path: string) => path.replaceAll("\\", "/");
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Scores bounded Git evidence without wall-clock input or repository execution. */
export function scoreGitEvidence(input: GitScoreInput): GitScoreContribution[] {
  const path = canonical(input.path);
  const maximumCommits = Math.max(1, Math.min(input.maximumCommits ?? 50, 100));
  const history = (input.history ?? []).slice(0, maximumCommits);
  const aliases = new Set([path]);
  for (const commit of history) {
    const previous = commit.previousPaths?.[path];
    if (previous) aliases.add(canonical(previous));
  }
  const matching = history
    .map((commit, ordinal) => ({ commit, ordinal }))
    .filter(({ commit }) =>
      commit.paths.some((item) => aliases.has(canonical(item))),
    );
  const frequency = history.length === 0 ? 0 : matching.length / history.length;
  const recency =
    matching.length === 0 ? 0 : 1 - matching[0]!.ordinal / history.length;
  const taskPaths = new Set((input.taskPaths ?? []).map(canonical));
  const coChanges = matching.filter(({ commit }) =>
    commit.paths.some((item) => taskPaths.has(canonical(item))),
  );
  const legacyRecent = new Set((input.recentPaths ?? []).map(canonical));
  const dirty = new Set(input.dirtyPaths.map(canonical));
  const revisions = matching.map(({ commit }) => commit.revision);
  const unavailable = !input.historyAvailable
    ? "Git history unavailable"
    : "no matching history";
  return [
    {
      source: "git-dirty",
      value: dirty.has(path) ? 1 : 0,
      reason: dirty.has(path)
        ? "local working change"
        : "no local working change",
      evidence: [],
    },
    {
      source: "git-recency",
      value: clamp01(Math.max(recency, legacyRecent.has(path) ? 1 : 0)),
      reason:
        matching.length || legacyRecent.has(path)
          ? "bounded ordinal commit recency"
          : unavailable,
      evidence: revisions.slice(0, 1),
    },
    {
      source: "git-frequency",
      value: clamp01(frequency),
      reason: matching.length
        ? `${matching.length} of ${history.length} bounded commits`
        : unavailable,
      evidence: revisions,
    },
    {
      source: "git-co-change",
      value: matching.length ? clamp01(coChanges.length / matching.length) : 0,
      reason: coChanges.length
        ? "changed with task-relevant paths"
        : unavailable,
      evidence: coChanges.map(({ commit }) => commit.revision),
    },
    {
      source: "git-task-diff",
      value: dirty.has(path) && taskPaths.has(path) ? 1 : 0,
      reason:
        dirty.has(path) && taskPaths.has(path)
          ? "task path has a working change"
          : "no task-relevant working change",
      evidence: [],
    },
  ];
}
