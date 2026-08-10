import { describe, expect, it } from "vitest";

import { partialResult } from "../src/result.js";

describe("Result", () => {
  it("preserves partial-success diagnostics", () => {
    const diagnostic = {
      schemaVersion: 1 as const,
      code: "SOURCE.PARTIAL",
      severity: "warning" as const,
      source: "repository",
      message: "One optional source was unavailable.",
    };

    expect(partialResult({ files: 3 }, [diagnostic])).toEqual({
      status: "partial",
      value: { files: 3 },
      diagnostics: [diagnostic],
    });
  });
});
