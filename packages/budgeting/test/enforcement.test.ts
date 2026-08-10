import { describe, expect, it } from "vitest";
import { enforceBudget } from "../src/index.js";
const limits = {
  bytes: 20,
  tokens: 5,
  files: 2,
  perItemBytes: 10,
  manifestBytes: 0,
};
describe("hard budgets", () => {
  it("handles tiny budgets", () =>
    expect(
      enforceBudget([{ id: "a", content: "abc" }], {
        ...limits,
        bytes: 0,
        tokens: 0,
      }).selected,
    ).toEqual([]));
  it("uses exact boundaries", () =>
    expect(
      enforceBudget([{ id: "a", content: "1234" }], {
        ...limits,
        bytes: 4,
        tokens: 1,
      }).overflow,
    ).toBe(false));
  it("does not split Unicode invalidly", () =>
    expect(
      enforceBudget([{ id: "a", content: "éé" }], {
        ...limits,
        bytes: 3,
        tokens: 1,
      }).selected[0]?.content,
    ).not.toContain("�"));
  it("reports mandatory too large", () =>
    expect(
      enforceBudget([{ id: "a", content: "x", mandatory: true }], {
        ...limits,
        bytes: 0,
        tokens: 0,
      }).excluded[0]?.reason,
    ).toContain("mandatory"));
  it("marks truncation", () =>
    expect(
      enforceBudget([{ id: "a", content: "123456" }], {
        ...limits,
        perItemBytes: 3,
      }).selected[0]?.truncated,
    ).toBe(true));
  it("supports metadata-only fallback", () =>
    expect(
      enforceBudget([{ id: "a", content: "x" }], {
        ...limits,
        manifestBytes: 20,
      }).selected,
    ).toEqual([]));
  it("enforces file redundancy caps", () =>
    expect(
      enforceBudget(
        [
          { id: "a", content: "x" },
          { id: "b", content: "x" },
        ],
        { ...limits, files: 1 },
      ).excluded,
    ).toHaveLength(1));
});
