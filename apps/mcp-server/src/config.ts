import { isAbsolute, relative, resolve } from "node:path";

export const MCP_SERVER_VERSION = "0.0.1";
export const MCP_PROTOCOL_VERSION = "1";

/** Maximum allowed workspace roots per session */
export const MAX_ALLOWED_ROOTS = 8;

/** Maximum tool output payload in bytes */
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2 MB

/** Maximum inbound JSON-RPC request line in bytes */
export const MAX_REQUEST_BYTES = 1024 * 1024;

/** Maximum normalized task description in bytes */
export const MAX_TASK_BYTES = 2048;

/** Maximum duration for any single tool call (ms) */
export const MAX_TOOL_DURATION_MS = 30_000;

/** Maximum number of files returned in a single search result */
export const MAX_SEARCH_RESULTS = 200;

/** Maximum graph traversal depth */
export const MAX_GRAPH_DEPTH = 4;

/** Maximum graph nodes returned */
export const MAX_GRAPH_NODES = 300;

/**
 * Canonicalize and validate an absolute path.
 * Throws if path is not absolute.
 */
export function canonicalizePath(p: string): string {
  if (!isAbsolute(p)) throw new TypeError("path must be absolute");
  return resolve(p);
}

function comparablePath(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

/**
 * Check that a candidate path is strictly within one of the allowed roots.
 * Returns the matching root, or throws if no root matches.
 */
export function assertWithinAllowedRoots(
  candidate: string,
  allowedRoots: readonly string[],
): string {
  const abs = canonicalizePath(candidate);
  for (const root of allowedRoots) {
    const canonRoot = canonicalizePath(root);
    const rel = relative(comparablePath(canonRoot), comparablePath(abs));
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
      return abs;
    }
  }
  throw new RangeError(
    `Path "${candidate}" is not within any allowed workspace root.`,
  );
}

export interface McpServerPackageBoundary {
  readonly packageName: "@fuzit/mcp-server";
}
