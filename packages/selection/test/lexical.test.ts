import { describe, expect, it } from "vitest";
import { normalizeTaskText, rankLexically } from "../src/index.js";
describe("lexical retrieval", () => {
  it("splits CamelCase", () =>
    expect(normalizeTaskText("AuthFailure")).toEqual(["auth", "failure"]));
  it("splits snake_case", () =>
    expect(normalizeTaskText("auth_failure")).toEqual(["auth", "failure"]));
  it("ranks path mentions", () =>
    expect(
      rankLexically("src/auth", [
        { path: "src/auth.ts", text: "" },
        { path: "x", text: "" },
      ])[0]?.path,
    ).toBe("src/auth.ts"));
  it("removes stop words", () =>
    expect(normalizeTaskText("the auth and code")).toEqual(["auth", "code"]));
  it("normalizes Unicode", () =>
    expect(normalizeTaskText("Ａuth")).toEqual(["auth"]));
  it("handles empty tasks", () =>
    expect(
      rankLexically("", [
        { path: "b", text: "" },
        { path: "a", text: "" },
      ]).map((x) => x.path),
    ).toEqual(["a", "b"]));
  it("breaks ties by path", () =>
    expect(
      rankLexically("none", [
        { path: "b", text: "" },
        { path: "a", text: "" },
      ])[0]?.path,
    ).toBe("a"));
});
