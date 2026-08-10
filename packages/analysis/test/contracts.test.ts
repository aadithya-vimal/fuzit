import { describe, expect, it } from "vitest";

import { createRepositoryFact } from "../src/index.js";

const fact = (basis: "direct" | "inferred", detector = "manifest") =>
  createRepositoryFact({
    kind: "language",
    value: "TypeScript",
    confidence: basis === "direct" ? 1 : 0.7,
    basis,
    evidence: ["package.json"],
    detector,
    conflictsWith: [],
  });

describe("repository facts", () => {
  it("distinguishes direct and inferred facts", () =>
    expect(fact("direct").basis).not.toBe(fact("inferred").basis));
  it("requires a confidence basis", () =>
    expect(fact("direct")).toMatchObject({
      confidence: 1,
      evidence: ["package.json"],
    }));
  it("preserves multiple detectors", () =>
    expect([fact("direct"), fact("inferred", "extension")]).toHaveLength(2));
  it("represents conflicts", () =>
    expect(
      createRepositoryFact({ ...fact("direct"), conflictsWith: ["fact:other"] })
        .conflictsWith,
    ).toEqual(["fact:other"]));
  it("creates stable IDs", () =>
    expect(fact("direct").id).toBe(fact("direct").id));
});
