import { createPlugin, parsePluginManifest } from "@fuzit/plugin-sdk";

export const INTENTIONAL_FAILURE_CODE = "REFERENCE_PLUGIN_FAILURE";

export const intentionalFailurePlugin = createPlugin({
  manifest: parsePluginManifest({
    schemaVersion: 1,
    id: "dev.fuzit.intentional-failure",
    name: "Fuzit intentional failure plugin",
    version: "1.0.0",
    protocol: "fuzit-plugin-v1",
    fuzitVersion: "^1.0.0",
    entryPoint: "src/index.ts",
    description:
      "Sanitized fixture that fails predictably for isolation tests.",
    capabilities: ["renderer"],
    permissions: { shell: false, persistence: false },
  }),
  handlers: {
    renderer: () => {
      throw new Error(INTENTIONAL_FAILURE_CODE);
    },
  },
});
