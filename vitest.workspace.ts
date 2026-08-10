import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@fuzit/analysis": fileURLToPath(
        new URL("./packages/analysis/src/index.ts", import.meta.url),
      ),
      "@fuzit/git": fileURLToPath(
        new URL("./packages/git/src/index.ts", import.meta.url),
      ),
      "@fuzit/graph": fileURLToPath(
        new URL("./packages/graph/src/index.ts", import.meta.url),
      ),
      "@fuzit/index": fileURLToPath(
        new URL("./packages/index/src/index.ts", import.meta.url),
      ),
      "@fuzit/profiles": fileURLToPath(
        new URL("./packages/profiles/src/index.ts", import.meta.url),
      ),
      "@fuzit/budgeting": fileURLToPath(
        new URL("./packages/budgeting/src/index.ts", import.meta.url),
      ),
      "@fuzit/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@fuzit/config": fileURLToPath(
        new URL("./packages/config/src/index.ts", import.meta.url),
      ),
      "@fuzit/discovery": fileURLToPath(
        new URL("./packages/discovery/src/index.ts", import.meta.url),
      ),
      "@fuzit/schemas": fileURLToPath(
        new URL("./packages/schemas/src/index.ts", import.meta.url),
      ),
      "@fuzit/scanner": fileURLToPath(
        new URL("./packages/scanner/src/index.ts", import.meta.url),
      ),
      "@fuzit/selection": fileURLToPath(
        new URL("./packages/selection/src/index.ts", import.meta.url),
      ),
      "@fuzit/renderer-markdown": fileURLToPath(
        new URL("./packages/renderers/markdown/src/index.ts", import.meta.url),
      ),
      "@fuzit/renderer-core": fileURLToPath(
        new URL("./packages/renderers/core/src/index.ts", import.meta.url),
      ),
      "@fuzit/renderer-json": fileURLToPath(
        new URL("./packages/renderers/json/src/index.ts", import.meta.url),
      ),
      "@fuzit/renderer-text": fileURLToPath(
        new URL("./packages/renderers/text/src/index.ts", import.meta.url),
      ),
      "@fuzit/renderer-xml": fileURLToPath(
        new URL("./packages/renderers/xml/src/index.ts", import.meta.url),
      ),
      "@fuzit/security": fileURLToPath(
        new URL("./packages/security/src/index.ts", import.meta.url),
      ),
      "@fuzit/watcher": fileURLToPath(
        new URL("./packages/watcher/src/index.ts", import.meta.url),
      ),
      "@fuzit/mcp-server": fileURLToPath(
        new URL("./apps/mcp-server/src/index.ts", import.meta.url),
      ),
      "@fuzit/provider-github": fileURLToPath(
        new URL("./packages/provider-github/src/index.ts", import.meta.url),
      ),
      "@fuzit/plugin-sdk": fileURLToPath(
        new URL("./packages/plugin-sdk/src/index.ts", import.meta.url),
      ),
      "@fuzit/plugin-host": fileURLToPath(
        new URL("./packages/plugin-host/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: [
      "apps/**/test/**/*.test.ts",
      "tooling/**/*.test.ts",
      "packages/**/test/**/*.test.ts",
      "packages/testing/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "tests/**/*.test.ts",
    ],
  },
});
