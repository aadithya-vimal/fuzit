import { describe, expect, it } from "vitest";

import { parseGitHistory } from "../src/index.js";

const separator = "\u001f";
const end = "\u001e";

describe("bounded Git history", () => {
  it("parses merge commits and changed paths", () => {
    const output = [
      "a".repeat(40),
      `${"b".repeat(40)} ${"c".repeat(40)}`,
      "Author",
      "author@example.test",
      "2026-01-01T00:00:00Z",
      "merge",
    ].join(separator);
    expect(
      parseGitHistory(`${output}\nspace file.ts\n${end}`)[0],
    ).toMatchObject({
      parents: ["b".repeat(40), "c".repeat(40)],
      changedPaths: ["space file.ts"],
    });
  });

  it("bounds long and non-UTF8 replacement subjects", () => {
    const subject = `bad�${"x".repeat(1000)}`;
    const output = [
      "a".repeat(40),
      "",
      "Author",
      "author@example.test",
      "2026-01-01T00:00:00Z",
      subject,
    ].join(separator);
    expect(parseGitHistory(`${output}${end}`)[0]!.subject).toHaveLength(500);
  });

  it("omits or hashes author email and tolerates shallow history", () => {
    const output = [
      "a".repeat(40),
      "",
      "Author",
      "author@example.test",
      "2026-01-01T00:00:00Z",
      "initial",
    ].join(separator);
    expect(parseGitHistory(`${output}${end}`)[0]!.authorEmail).toBeNull();
    expect(parseGitHistory(`${output}${end}`, "hash")[0]!.authorEmail).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(parseGitHistory("")).toEqual([]);
  });
});
