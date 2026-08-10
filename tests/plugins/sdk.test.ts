import { describe, expect, it } from "vitest";
import {
  createPlugin,
  parsePluginManifest,
  type PluginInstance,
} from "@fuzit/plugin-sdk";

describe("Restricted Plugin SDK API Surface (V1-102)", () => {
  it("exposes curated public contracts without internal host objects", () => {
    const validManifest = parsePluginManifest({
      schemaVersion: 1,
      id: "com.example.custom-parser",
      name: "Custom Parser Plugin",
      version: "1.0.0",
      fuzitVersion: "^1.0.0",
      entryPoint: "dist/plugin.js",
      capabilities: ["parser", "secret-detector"],
      permissions: {
        shell: false,
      },
    });

    const pluginInstance: PluginInstance = createPlugin({
      manifest: validManifest,
      handlers: {
        parser: (input) => {
          return {
            symbols: [
              {
                name: "myFunction",
                kind: "function",
                location: { path: input.fileRecord.path, line: 1 },
              },
            ],
            imports: [{ source: "node:fs", importedSymbols: ["readFileSync"] }],
          };
        },
        "secret-detector": () => {
          return {
            findings: [],
          };
        },
      },
    });

    expect(pluginInstance.manifest.id).toBe("com.example.custom-parser");
    expect(pluginInstance.handlers.parser).toBeDefined();
    expect(pluginInstance.handlers["secret-detector"]).toBeDefined();
  });

  it("throws error if plugin declares capability without providing a handler implementation", () => {
    const manifestWithMissingHandler = parsePluginManifest({
      schemaVersion: 1,
      id: "com.example.incomplete",
      name: "Incomplete Plugin",
      version: "1.0.0",
      fuzitVersion: "^1.0.0",
      entryPoint: "dist/plugin.js",
      capabilities: ["ranker"],
    });

    expect(() =>
      createPlugin({
        manifest: manifestWithMissingHandler,
        handlers: {},
      }),
    ).toThrowError(
      "Plugin 'com.example.incomplete' declares capability 'ranker' but provides no handler implementation for it.",
    );
  });
});
