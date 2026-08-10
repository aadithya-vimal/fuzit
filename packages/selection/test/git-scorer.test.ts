import { describe, expect, it } from "vitest";
import { scoreGitEvidence } from "../src/index.js";
const score = (overrides = {}) =>
  scoreGitEvidence({
    path: "a",
    dirtyPaths: [],
    recentPaths: [],
    historyAvailable: true,
    ...overrides,
  });
describe("Git scoring", () => {
  it("handles no Git", () =>
    expect(score({ historyAvailable: false })[1]?.reason).toBe(
      "Git history unavailable",
    ));
  it("scores dirty files", () =>
    expect(score({ dirtyPaths: ["a"] })[0]?.value).toBe(1));
  it("does not score recent unrelated changes", () =>
    expect(score({ recentPaths: ["b"] })[1]?.value).toBe(0));
  it("keeps old relevant files neutral", () =>
    expect(score()[1]?.value).toBe(0));
  it("handles shallow history", () =>
    expect(score({ historyAvailable: false })).toHaveLength(5));
  it("uses ordinal recency and bounded frequency without a clock", () => {
    const result = score({
      history: [
        { revision: "new", paths: ["b"] },
        { revision: "middle", paths: ["a", "task"] },
        { revision: "old", paths: ["a"] },
      ],
      taskPaths: ["task"],
    });
    expect(result.map(({ source }) => source)).toEqual([
      "git-dirty",
      "git-recency",
      "git-frequency",
      "git-co-change",
      "git-task-diff",
    ]);
    expect(result[1]?.value).toBeCloseTo(2 / 3);
    expect(result[2]?.value).toBeCloseTo(2 / 3);
    expect(result[3]?.value).toBe(1 / 2);
  });
  it("follows bounded rename evidence", () => {
    const result = score({
      path: "new.ts",
      history: [
        {
          revision: "rename",
          paths: ["old.ts"],
          previousPaths: { "new.ts": "old.ts" },
        },
      ],
    });
    expect(result[2]).toMatchObject({ value: 1, evidence: ["rename"] });
  });
});
