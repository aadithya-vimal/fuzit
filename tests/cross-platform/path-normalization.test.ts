import { describe, expect, it } from "vitest";
import {
  normalizeRepositoryRelativePath,
  toRepositoryRelativePath,
} from "@fuzit/core";

describe("canonical path normalization fixtures", () => {
  it("canonicalizes separators and dot segments deterministically", () => {
    const fixtures = [
      "packages\\core/./src/../src/index.ts",
      "packages/core/src/index.ts",
      "./packages//core/src/index.ts",
    ];
    expect(fixtures.map(normalizeRepositoryRelativePath)).toEqual([
      "packages/core/src/index.ts",
      "packages/core/src/index.ts",
      "packages/core/src/index.ts",
    ]);
  });

  it("preserves case so collisions remain visible to policy", () => {
    const collision = ["src/Thing.ts", "src/thing.ts"].map(
      normalizeRepositoryRelativePath,
    );
    expect(collision).toEqual(["src/Thing.ts", "src/thing.ts"]);
    expect(new Set(collision).size).toBe(2);
  });

  it("normalizes both sides of a case-only rename without losing identity", () => {
    const rename = {
      from: normalizeRepositoryRelativePath("src\\Thing.ts"),
      to: normalizeRepositoryRelativePath("src/thing.ts"),
    };
    expect(rename).toEqual({ from: "src/Thing.ts", to: "src/thing.ts" });
  });

  it("rejects drive changes, absolute inputs, and repository escapes", () => {
    expect(() =>
      toRepositoryRelativePath("C:\\repo", "D:\\repo\\file.ts"),
    ).toThrowError(expect.objectContaining({ code: "PATH.ROOT_MISMATCH" }));
    expect(() =>
      normalizeRepositoryRelativePath("/rooted/file.ts"),
    ).toThrowError(expect.objectContaining({ code: "PATH.ABSOLUTE" }));
    expect(() =>
      normalizeRepositoryRelativePath("../../escape.ts"),
    ).toThrowError(expect.objectContaining({ code: "PATH.ESCAPE" }));
  });

  it("produces the same bundle-facing identity for host separator forms", () => {
    expect(normalizeRepositoryRelativePath("src\\nested\\file.ts")).toBe(
      normalizeRepositoryRelativePath("src/nested/file.ts"),
    );
  });
});
