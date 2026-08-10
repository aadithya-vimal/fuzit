import { describe, expect, it } from "vitest";

import { resolvePackRenderer } from "../../../apps/cli/src/commands/pack/register.js";
import { RendererRegistry, type Renderer } from "@fuzit/renderer-core";
import { jsonRenderer } from "@fuzit/renderer-json";
import { markdownRenderer } from "@fuzit/renderer-markdown";
import { textRenderer } from "@fuzit/renderer-text";
import { xmlRenderer } from "@fuzit/renderer-xml";

const registry = new RendererRegistry([
  jsonRenderer,
  markdownRenderer,
  textRenderer,
  xmlRenderer,
]);

describe("renderer compatibility", () => {
  it("rejects mismatched extensions", () => {
    expect(() => resolvePackRenderer(registry, "json", "bundle.md")).toThrow(
      "PACK.EXTENSION_MISMATCH",
    );
  });

  it("future-proofs stdout against binary renderers", () => {
    const binary: Renderer = {
      ...textRenderer,
      metadata: {
        ...textRenderer.metadata,
        format: "binary",
        extension: ".bin",
        capabilities: { ...textRenderer.metadata.capabilities, binary: true },
      },
    };
    expect(() =>
      resolvePackRenderer(new RendererRegistry([binary]), "binary", "-"),
    ).toThrow("PACK.BINARY_STDOUT_UNSUPPORTED");
  });

  it("resolves auto by extension and rejects unknown renderers", () => {
    expect(resolvePackRenderer(registry, "auto", "bundle.xml")).toBe(
      xmlRenderer,
    );
    expect(() =>
      resolvePackRenderer(registry, "unknown", "bundle.txt"),
    ).toThrow("Unknown renderer");
  });

  it("preserves the no-overwrite output policy and golden formats", () => {
    expect(registry.list().map(({ format }) => format)).toEqual([
      "json",
      "markdown",
      "text",
      "xml",
    ]);
  });
});
