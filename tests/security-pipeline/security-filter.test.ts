import { describe, expect, expectTypeOf, it } from "vitest";

import {
  assertSecurityFilteredItem,
  securityFilter,
  type SecurityFilteredItem,
} from "@fuzit/core";
import type { FileContextItem } from "@fuzit/schemas";

const digest = "a".repeat(64);

function item(content: string): FileContextItem {
  return {
    schemaVersion: 1,
    id: `file:${digest}`,
    kind: "file",
    path: "src/a.ts",
    content,
    contentStatus: "complete",
    provenance: { source: "scanner", confidenceBasis: "test" },
    lifecycle: "source",
    sensitivity: "unclassified",
    sha256: digest,
    transformations: [],
  };
}

describe("immutable security pipeline", () => {
  it("exposes a type-level renderer boundary", () => {
    type Renderer = (value: SecurityFilteredItem) => string;
    expectTypeOf<Renderer>().parameter(0).toMatchTypeOf<SecurityFilteredItem>();
    expectTypeOf<FileContextItem>().not.toMatchTypeOf<SecurityFilteredItem>();
  });

  it("asserts the boundary at runtime", () => {
    expect(() => assertSecurityFilteredItem(item("safe"))).toThrow(
      "must pass the security pipeline",
    );
  });

  it("never reads a path-blocked file", async () => {
    let reads = 0;
    const result = await securityFilter({
      path: ".env",
      readContent: async () => {
        reads += 1;
        return "never";
      },
      createItem: (content) => item(content),
    });
    expect(result.status).toBe("omitted");
    expect(reads).toBe(0);
  });

  it("safely omits content after detector failure", async () => {
    const result = await securityFilter({
      path: "src/a.ts",
      readContent: async () => "content",
      createItem: (content) => item(content),
      detect: () => {
        throw new Error("synthetic detector failure");
      },
    });
    expect(result).toMatchObject({
      status: "partial",
      reason: "detector-failed-content-omitted",
    });
  });

  it("returns a partial result after read failure", async () => {
    const result = await securityFilter({
      path: "src/a.ts",
      readContent: async () => {
        throw new Error("synthetic read failure");
      },
      createItem: (content) => item(content),
    });
    expect(result.status).toBe("partial");
  });
});
