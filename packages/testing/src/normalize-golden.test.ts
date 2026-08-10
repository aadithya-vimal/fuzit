import { describe, expect, it } from "vitest";

import { normalizeGoldenFields } from "./normalize-golden.js";

describe("normalizeGoldenFields", () => {
  it("preserves meaningful collection ordering", () => {
    const normalized = normalizeGoldenFields(
      {
        generated: "first\r\nsecond\r\n",
        items: ["second", "first"],
      },
      { volatileFields: ["generated"] },
    );

    expect(normalized.generated).toBe("first\nsecond\n");
    expect(normalized.items).toEqual(["second", "first"]);
  });

  it("normalizes Windows separators only in a declared volatile field", () => {
    const normalized = normalizeGoldenFields(
      {
        sourcePath: "C:\\work\\fuzit\\src\\index.ts",
        renderedPath: "C:\\work\\fuzit\\src\\index.ts\r\n",
      },
      {
        volatileFields: ["renderedPath"],
        rootPath: "C:\\work\\fuzit",
      },
    );

    expect(normalized.sourcePath).toBe("C:\\work\\fuzit\\src\\index.ts");
    expect(normalized.renderedPath).toBe("<ROOT>/src/index.ts\n");
  });
});
