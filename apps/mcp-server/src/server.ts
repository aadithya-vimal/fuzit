import { MCP_SERVER_VERSION } from "./config.js";
import { StdioTransport, serverInfo } from "./transport.js";
import { validateAllowedRoots, WorkspaceCache } from "./workspace.js";
import { fuzitStatus, fuzitProfiles } from "./tools/status.js";
import { fuzitSearch, fuzitGetContext } from "./tools/context.js";
import { fuzitExplainSelection } from "./tools/explain.js";
import { fuzitGraphNeighbors, fuzitGraphImpact } from "./tools/graph.js";
import { fuzitRecentChanges } from "./tools/changes.js";
import { fuzitCreateBundle } from "./tools/bundle.js";

/** Valid tool names */
const TOOL_NAMES = [
  "fuzit_status",
  "fuzit_profiles",
  "fuzit_search",
  "fuzit_get_context",
  "fuzit_explain_selection",
  "fuzit_graph_neighbors",
  "fuzit_graph_impact",
  "fuzit_recent_changes",
  "fuzit_create_bundle",
] as const;

type ToolName = (typeof TOOL_NAMES)[number];

export interface McpServerOptions {
  readonly allowedRoots: readonly string[];
}

export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const allowedRoots = await validateAllowedRoots(options.allowedRoots);
  const cache = new WorkspaceCache();

  const context = { allowedRoots };

  const transport = new StdioTransport(async (method, params) => {
    // Initialization / capabilities
    if (method === "initialize") {
      return {
        serverInfo: serverInfo(),
        capabilities: { tools: {} },
      };
    }

    // List tools
    if (method === "tools/list") {
      return {
        tools: TOOL_NAMES.map((name) => ({
          name,
          description: getToolDescription(name),
          inputSchema: getToolInputSchema(name),
        })),
      };
    }

    // Tool call dispatch
    if (method === "tools/call") {
      const p = params as { name: string; arguments: unknown };
      const toolName = p?.name as ToolName | undefined;
      const args = (p?.arguments ?? {}) as Record<string, unknown>;

      if (!toolName || !TOOL_NAMES.includes(toolName as ToolName)) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      switch (toolName) {
        case "fuzit_status":
          return fuzitStatus(args["root"], context);
        case "fuzit_profiles":
          return fuzitProfiles(context);
        case "fuzit_search":
          return fuzitSearch(
            args as Parameters<typeof fuzitSearch>[0],
            context,
            cache,
          );
        case "fuzit_get_context":
          return fuzitGetContext(
            args as Parameters<typeof fuzitGetContext>[0],
            context,
            cache,
          );
        case "fuzit_explain_selection":
          return fuzitExplainSelection(
            args as Parameters<typeof fuzitExplainSelection>[0],
            context,
            cache,
          );
        case "fuzit_graph_neighbors":
          return fuzitGraphNeighbors(
            args as Parameters<typeof fuzitGraphNeighbors>[0],
            context,
            (root) => cache.getSnapshot(root),
          );
        case "fuzit_graph_impact":
          return fuzitGraphImpact(
            args as Parameters<typeof fuzitGraphImpact>[0],
            context,
            (root) => cache.getSnapshot(root),
          );
        case "fuzit_recent_changes":
          return fuzitRecentChanges(
            args as Parameters<typeof fuzitRecentChanges>[0],
            context,
          );
        case "fuzit_create_bundle":
          return fuzitCreateBundle(
            args as Parameters<typeof fuzitCreateBundle>[0],
            context,
            cache,
          );
      }
    }

    // Notifications do not return results
    if (method.startsWith("notifications/")) {
      return null;
    }

    throw new Error(`Method not supported: ${method}`);
  });

  process.stderr.write(
    `[fuzit-mcp] v${MCP_SERVER_VERSION} starting (roots: ${allowedRoots.length})\n`,
  );

  transport.start();
}

function getToolDescription(name: ToolName): string {
  switch (name) {
    case "fuzit_status":
      return "Run Fuzit doctor checks for the given workspace root.";
    case "fuzit_profiles":
      return "List available Fuzit context profiles.";
    case "fuzit_search":
      return "Search repository files by task relevance.";
    case "fuzit_get_context":
      return "Get full task context for a given workspace root and task description.";
    case "fuzit_explain_selection":
      return "Explain why files were selected or excluded for a given task.";
    case "fuzit_graph_neighbors":
      return "Get bounded graph neighborhood of a file.";
    case "fuzit_graph_impact":
      return "Get bounded impact set of files affected by a change.";
    case "fuzit_recent_changes":
      return "Get recent Git commits for the workspace root.";
    case "fuzit_create_bundle":
      return "Create a context bundle file within the workspace root.";
  }
}

function getToolInputSchema(name: ToolName): object {
  const withRoot = {
    type: "object" as const,
    required: ["root"],
    properties: {
      root: { type: "string", description: "Absolute workspace root path." },
    },
    additionalProperties: true,
  };

  switch (name) {
    case "fuzit_status":
    case "fuzit_recent_changes":
      return withRoot;
    case "fuzit_profiles":
      return { type: "object" as const, properties: {} };
    default:
      return withRoot;
  }
}
