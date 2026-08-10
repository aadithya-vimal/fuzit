export function normalizeTaskText(value: string): string[] {
  return value
    .normalize("NFKC")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_/\\.-]+/g, " ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (token) =>
        token.length > 1 && !["the", "and", "for", "with"].includes(token),
    );
}
export function rankLexically(
  task: string,
  candidates: readonly { path: string; text: string }[],
) {
  const terms = normalizeTaskText(task);
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: terms.reduce(
        (score, term) =>
          score +
          normalizeTaskText(`${candidate.path} ${candidate.text}`).filter(
            (token) => token === term,
          ).length,
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
