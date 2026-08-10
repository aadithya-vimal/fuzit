import { describe, expect, it } from "vitest";
import { classifyLifecycle, scorePathLifecycle } from "../src/index.js";
const score = (overrides = {}) =>
  scorePathLifecycle({
    path: "a",
    explicitPaths: [],
    generated: false,
    category: "source",
    lifecycle: "unknown",
    trust: 1,
    ...overrides,
  });
describe("path lifecycle scoring", () => {
  it("penalizes generated", () =>
    expect(
      score({ generated: true }).find((x) => x.source === "generated")?.value,
    ).toBe(-4));
  it("rewards relevant tests", () =>
    expect(
      score({ category: "test" }).find((x) => x.source === "test")?.value,
    ).toBe(2));
  it("lets explicit paths override", () =>
    expect(score({ explicitPaths: ["a"] })[0]?.value).toBe(10));
  it("keeps unknown lifecycle neutral", () =>
    expect(score().find((x) => x.source === "lifecycle")?.value).toBe(0));
  it("preserves deterministic ties", () => expect(score()).toEqual(score()));
});

describe("lifecycle classification", () => {
  it.each([
    ["src/generated/client.ts", "generated"],
    ["vendor/library.ts", "vendored"],
    ["tests/unit.test.ts", "test"],
    ["docs/guide.md", "documentation"],
    ["tool.config.ts", "configuration"],
  ])("classifies %s as %s from controlled paths", (path, lifecycle) => {
    expect(classifyLifecycle({ path })).toMatchObject({
      lifecycle,
      confidence: "high",
    });
  });
  it.each(["deprecated", "legacy", "experimental"] as const)(
    "honors the %s annotation",
    (annotation) =>
      expect(
        classifyLifecycle({ path: "src/a.ts", annotations: [annotation] }),
      ).toMatchObject({
        lifecycle: annotation,
        evidence: [`${annotation} annotation`],
      }),
  );
  it("keeps an old but observed file active without using age", () => {
    expect(
      classifyLifecycle({
        path: "src/old.ts",
        activityEvidence: ["imported by src/main.ts"],
      }),
    ).toEqual({
      lifecycle: "active",
      confidence: "medium",
      evidence: ["imported by src/main.ts"],
    });
  });
  it("returns explainable unknown evidence", () => {
    expect(classifyLifecycle({ path: "src/a.ts" })).toEqual({
      lifecycle: "unknown",
      confidence: "low",
      evidence: ["no controlled lifecycle evidence"],
    });
  });
});
