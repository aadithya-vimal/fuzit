import { describe, expect, it } from "vitest";
import {
  createPolyglotReport,
  polyglotChecks,
} from "./clean-room-polyglot.mjs";

const valid = {
  commit: "a".repeat(40),
  results: polyglotChecks.map((id) => ({ id, status: "passed" })),
};
describe("Python/polyglot clean-room report", () => {
  it("records language, package, boundary, and bounded fallback facts", () =>
    expect(createPolyglotReport(valid)).toMatchObject({
      status: "passed",
      languages: ["Python", "TypeScript"],
      crossLanguageBoundaries: "verified",
      parserUnavailableFallback: "partial-bounded",
    }));
  it("rejects partial evidence", () =>
    expect(() =>
      createPolyglotReport({ ...valid, results: valid.results.slice(1) }),
    ).toThrow(/missing/));
});
