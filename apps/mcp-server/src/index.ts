import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { startMcpServer } from "./server.js";
import { MCP_SERVER_VERSION } from "./config.js";

export { startMcpServer } from "./server.js";
export {
  MCP_SERVER_VERSION,
  MCP_PROTOCOL_VERSION,
  MAX_ALLOWED_ROOTS,
  MAX_OUTPUT_BYTES,
  MAX_TOOL_DURATION_MS,
  MAX_SEARCH_RESULTS,
  MAX_GRAPH_DEPTH,
  MAX_GRAPH_NODES,
  canonicalizePath,
  assertWithinAllowedRoots,
} from "./config.js";
export {
  runTool,
  boundPayload,
  validateRoot,
  withTimeout,
  type McpCallContext,
  type McpToolResult,
} from "./tool-runner.js";
export {
  validateAllowedRoots,
  validatePath,
  WorkspaceCache,
  type RepositoryAcquisition,
} from "./workspace.js";

export interface McpServerPackageBoundary {
  readonly packageName: "@fuzit/mcp-server";
}

// CLI entry point
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    process.stderr.write(
      `fuzit-mcp v${MCP_SERVER_VERSION}: usage: node dist/index.js <root1> [root2...]\n`,
    );
    process.exit(1);
  }
  await startMcpServer({ allowedRoots: roots });
}
