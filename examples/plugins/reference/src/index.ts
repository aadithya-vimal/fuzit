import { createPlugin, parsePluginManifest } from "@fuzit/plugin-sdk";

export const referencePlugin = createPlugin({
  manifest: parsePluginManifest({
    schemaVersion: 1,
    id: "dev.fuzit.reference",
    name: "Fuzit deterministic reference plugin",
    version: "1.0.0",
    protocol: "fuzit-plugin-v1",
    fuzitVersion: "^1.0.0",
    entryPoint: "src/index.ts",
    description: "Harmless deterministic renderer and profile example.",
    capabilities: ["renderer", "profile"],
    permissions: { shell: false, persistence: false },
  }),
  handlers: {
    renderer: ({ bundle }) => ({
      formatName: "fuzit-reference-json",
      mimeType: "application/json",
      renderedText: JSON.stringify({
        schemaVersion: 1,
        bundleId: bundle.id,
        paths: bundle.items.map(({ path }) => path).sort(),
        warnings: [...bundle.warnings].sort(),
      }),
    }),
    profile: ({ profileName }) => ({
      profileName: `${profileName}-reference`,
      maxDepth: 2,
      includeGitHistory: false,
      includeSymbolGraph: true,
      rules: { deterministic: true },
    }),
  },
});
