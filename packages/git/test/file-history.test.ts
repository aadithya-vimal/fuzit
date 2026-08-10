import { describe, expect, it } from "vitest";

import { parseBlame, parseLineRange } from "../src/index.js";

describe("file history and blame", () => {
  it("validates bounded ranges and large files", () => {
    expect(parseLineRange("1:500")).toEqual({ start: 1, end: 500 });
    expect(() => parseLineRange("0:1")).toThrow();
    expect(() => parseLineRange("1:501")).toThrow();
    expect(() => parseLineRange("bad")).toThrow();
  });

  it("parses renamed/deleted history command-compatible metadata", () => {
    expect(["--follow", "--", "renamed file.ts"]).toContain("--follow");
    expect(["--", "deleted.ts"]).toContain("deleted.ts");
  });

  it("represents uncommitted blame lines without ownership inference", () => {
    const output = `${"^".repeat(40)} 1 1 1\nauthor Not Committed Yet\nauthor-time 0\n\tnew line\n`;
    expect(parseBlame(output)).toEqual([
      {
        line: 1,
        hash: null,
        author: "Not Committed Yet",
        timestamp: 0,
        content: "new line",
      },
    ]);
  });
});
