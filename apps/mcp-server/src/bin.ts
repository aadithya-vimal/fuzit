#!/usr/bin/env node

import { MCP_SERVER_VERSION } from "./config.js";
import { startMcpServer } from "./server.js";

const roots = process.argv.slice(2);

if (roots.length === 0) {
  process.stderr.write(
    `fuzit-mcp v${MCP_SERVER_VERSION}: usage: fuzit-mcp <root1> [root2...]\n`,
  );
  process.exit(1);
}

await startMcpServer({ allowedRoots: roots });
