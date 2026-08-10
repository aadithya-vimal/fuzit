import {
  MAX_REQUEST_BYTES,
  MCP_SERVER_VERSION,
  MCP_PROTOCOL_VERSION,
} from "./config.js";
import { redactSensitiveText } from "@fuzit/security";

export type McpRequest = {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: unknown;
};

export type McpNotification = {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: unknown;
};

export type McpResponse = {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
} & (
  | { readonly result: unknown }
  | { readonly error: { code: number; message: string } }
);

type MessageHandler = (
  method: string,
  params: unknown,
  id: string | number,
) => Promise<unknown>;

/**
 * Stdio MCP transport.
 * Reads JSON-RPC 2.0 messages from stdin (newline-delimited).
 * Writes responses to stdout.
 * No network listener is opened.
 */
export class StdioTransport {
  private readonly handler: MessageHandler;
  private buffer = "";
  private closed = false;

  constructor(handler: MessageHandler) {
    this.handler = handler;
  }

  start(): void {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.processBuffer();
    });
    process.stdin.on("end", () => {
      this.closed = true;
    });
    process.stdin.resume();
  }

  private processBuffer(): void {
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        if (Buffer.byteLength(line, "utf8") > MAX_REQUEST_BYTES) {
          this.writeError(null, -32600, "Request exceeds maximum size.");
        } else {
          void this.handleLine(line);
        }
      }
    }
  }

  private async handleLine(line: string): Promise<void> {
    let request: McpRequest;
    try {
      request = JSON.parse(line) as McpRequest;
    } catch {
      // malformed JSON — write error but continue
      this.writeError(null, -32700, "Parse error");
      return;
    }

    if (request.jsonrpc !== "2.0") {
      this.writeError(request.id ?? null, -32600, "Invalid Request");
      return;
    }

    try {
      const result = await this.handler(
        request.method,
        request.params,
        request.id,
      );
      this.writeResult(request.id, result);
    } catch (error) {
      const message = redactSensitiveText(
        error instanceof Error ? error.message : "Internal error",
      );
      this.writeError(request.id, -32603, message);
    }
  }

  private writeResult(id: string | number, result: unknown): void {
    const response: McpResponse = { jsonrpc: "2.0", id, result };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }

  private writeError(
    id: string | number | null,
    code: number,
    message: string,
  ): void {
    const response = {
      jsonrpc: "2.0",
      id: id ?? 0,
      error: { code, message },
    };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

/**
 * Build a server info response consistent with the MCP protocol.
 */
export function serverInfo() {
  return {
    name: "fuzit",
    version: MCP_SERVER_VERSION,
    protocol: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: true,
    },
  };
}
