import { describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "@fuzit/core";

describe("long and Unicode path fixtures", () => {
  it("preserves long, spaced, non-ASCII, and emoji segments", () => {
    const path = [
      "packages with spaces",
      ...Array.from({ length: 18 }, (_, index) => `segment-${index}-資料`),
      "context-🚀-✓.ts",
    ].join("/");
    const canonical = normalizeRepositoryRelativePath(path);
    expect(canonical).toBe(path);
    expect(canonical.length).toBeGreaterThan(260);
  });

  it("preserves Unicode normalization forms as distinct filesystem names", () => {
    const composed = normalizeRepositoryRelativePath("docs/café.md");
    const decomposed = normalizeRepositoryRelativePath("docs/cafe\u0301.md");
    expect(composed.normalize("NFC")).toBe(decomposed.normalize("NFC"));
    expect(composed).not.toBe(decomposed);
  });

  it("serializes display and process arguments without truncation or shell parsing", () => {
    const path = normalizeRepositoryRelativePath(
      "folder with spaces/報告 & notes/context-🚀.md",
    );
    const arguments_ = ["--path", path];
    expect(JSON.parse(JSON.stringify(arguments_))).toEqual(arguments_);
    expect(arguments_[1]).toBe(path);
  });

  it("rejects an absolute Unicode path rather than trimming it", () => {
    expect(() =>
      normalizeRepositoryRelativePath("/資料/context-🚀.md"),
    ).toThrowError(expect.objectContaining({ code: "PATH.ABSOLUTE" }));
  });
});
