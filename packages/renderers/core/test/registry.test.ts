import { describe, expect, it } from "vitest";

import {
  noRendererOptions,
  RendererRegistry,
  type Renderer,
} from "../src/index.js";

const renderer: Renderer = {
  metadata: {
    schemaVersion: 1,
    format: "test",
    mediaType: "text/plain",
    extension: ".txt",
    capabilities: { binary: false, diagnostics: true, provenance: true },
    deterministic: true,
  },
  options: noRendererOptions,
  render: () => "test",
};

describe("RendererRegistry", () => {
  it("rejects duplicate formats", () => {
    expect(() => new RendererRegistry([renderer, renderer])).toThrow(
      "Duplicate renderer format",
    );
  });

  it("rejects unknown formats", () => {
    expect(() => new RendererRegistry().get("unknown")).toThrow(
      "Unknown renderer format",
    );
  });

  it("validates deterministic options", () => {
    expect(renderer.options.parse({})).toEqual({});
    expect(() => renderer.options.parse({ volatile: true })).toThrow(
      "empty object",
    );
  });
});
