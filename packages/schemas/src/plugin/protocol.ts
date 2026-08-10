import { Buffer } from "node:buffer";
import { z } from "zod";
import { diagnosticSchema } from "../diagnostic.js";
import { pluginCapabilitySchema, pluginPermissionsSchema } from "./manifest.js";

/**
 * Maximum permitted plugin payload size in bytes (16 MB).
 * Enforces bounded message size constraints to prevent unbounded memory allocation.
 */
export const MAX_PLUGIN_FRAME_BYTES = 16 * 1024 * 1024;

/**
 * Standard plugin protocol version identifier.
 */
export const PLUGIN_PROTOCOL_VERSION = "fuzit-plugin-v1" as const;

/**
 * Common base frame envelope schema.
 */
export const pluginMessageHeaderSchema = z.strictObject({
  requestId: z.string().min(1),
  timestamp: z.number().int().positive().optional(),
});

/**
 * Handshake Request (capability negotiation & version check).
 */
export const pluginHandshakeRequestSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("handshake_request"),
  pluginId: z.string().min(1),
  protocolVersion: z.string().min(1),
  requestedCapabilities: z.array(pluginCapabilitySchema).min(1),
  permissions: pluginPermissionsSchema.optional(),
});

export type PluginHandshakeRequest = z.infer<
  typeof pluginHandshakeRequestSchema
>;

/**
 * Handshake Response.
 */
export const pluginHandshakeResponseSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("handshake_response"),
  success: z.boolean(),
  acceptedCapabilities: z.array(pluginCapabilitySchema),
  error: z.string().optional(),
});

export type PluginHandshakeResponse = z.infer<
  typeof pluginHandshakeResponseSchema
>;

/**
 * Execution Request.
 */
export const pluginExecuteRequestSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("execute_request"),
  capability: pluginCapabilitySchema,
  payload: z.unknown(),
  timeoutMs: z.number().int().positive().optional(),
});

export type PluginExecuteRequest = z.infer<typeof pluginExecuteRequestSchema>;

/**
 * Execution Response.
 */
export const pluginExecuteResponseSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("execute_response"),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  diagnostics: z.array(diagnosticSchema).optional(),
});

export type PluginExecuteResponse = z.infer<typeof pluginExecuteResponseSchema>;

/**
 * Cancellation Request.
 */
export const pluginCancelRequestSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("cancel_request"),
  targetRequestId: z.string().min(1),
  reason: z.string().optional(),
});

export type PluginCancelRequest = z.infer<typeof pluginCancelRequestSchema>;

/**
 * Diagnostic Event.
 */
export const pluginDiagnosticEventSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("diagnostic_event"),
  diagnostic: diagnosticSchema,
});

export type PluginDiagnosticEvent = z.infer<typeof pluginDiagnosticEventSchema>;

/**
 * Shutdown Request.
 */
export const pluginShutdownRequestSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("shutdown_request"),
});

export type PluginShutdownRequest = z.infer<typeof pluginShutdownRequestSchema>;

/**
 * Shutdown Response.
 */
export const pluginShutdownResponseSchema = pluginMessageHeaderSchema.extend({
  type: z.literal("shutdown_response"),
  success: z.boolean(),
});

export type PluginShutdownResponse = z.infer<
  typeof pluginShutdownResponseSchema
>;

/**
 * Discriminated union of all framed plugin protocol messages.
 */
export const pluginMessageSchema = z.discriminatedUnion("type", [
  pluginHandshakeRequestSchema,
  pluginHandshakeResponseSchema,
  pluginExecuteRequestSchema,
  pluginExecuteResponseSchema,
  pluginCancelRequestSchema,
  pluginDiagnosticEventSchema,
  pluginShutdownRequestSchema,
  pluginShutdownResponseSchema,
]);

export type PluginMessage = z.infer<typeof pluginMessageSchema>;

export function parsePluginMessage(input: unknown): PluginMessage {
  return pluginMessageSchema.parse(input);
}

/**
 * Encodes a PluginMessage into a length-prefixed frame Buffer.
 * Frame structure: [4 bytes uint32 BE length header][JSON payload UTF-8 bytes]
 */
export function encodePluginFrame(message: PluginMessage): Buffer {
  const validated = parsePluginMessage(message);
  const jsonStr = JSON.stringify(validated);
  const payloadBuffer = Buffer.from(jsonStr, "utf-8");

  if (payloadBuffer.length > MAX_PLUGIN_FRAME_BYTES) {
    throw new Error(
      `Plugin frame payload size (${payloadBuffer.length} bytes) exceeds maximum permitted limit (${MAX_PLUGIN_FRAME_BYTES} bytes)`,
    );
  }

  const frameHeader = Buffer.alloc(4);
  frameHeader.writeUInt32BE(payloadBuffer.length, 0);

  return Buffer.concat([frameHeader, payloadBuffer]);
}

/**
 * Stateful stream decoder for processing length-prefixed stdio plugin frames.
 * Handles fragmented chunks, coalesced messages, max size bounds, and malformed JSON.
 */
export class PluginFrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);
  private maxFrameBytes: number;

  constructor(maxFrameBytes: number = MAX_PLUGIN_FRAME_BYTES) {
    this.maxFrameBytes = maxFrameBytes;
  }

  /**
   * Push incoming chunk to internal buffer and extract completed frames.
   */
  public push(chunk: Buffer): PluginMessage[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: PluginMessage[] = [];

    while (this.buffer.length >= 4) {
      const payloadLength = this.buffer.readUInt32BE(0);

      if (payloadLength > this.maxFrameBytes) {
        // Reset buffer and fail closed to prevent memory allocation attack
        this.buffer = Buffer.alloc(0);
        throw new Error(
          `Oversized frame header encountered (${payloadLength} bytes). Maximum allowed limit is ${this.maxFrameBytes} bytes. Stream reset.`,
        );
      }

      if (this.buffer.length < 4 + payloadLength) {
        // Partial frame, await more data
        break;
      }

      const payloadBuffer = this.buffer.subarray(4, 4 + payloadLength);
      this.buffer = this.buffer.subarray(4 + payloadLength);

      try {
        const jsonStr = payloadBuffer.toString("utf-8");
        const jsonObject = JSON.parse(jsonStr);
        const message = parsePluginMessage(jsonObject);
        messages.push(message);
      } catch (err) {
        throw new Error(
          `Failed to parse plugin frame: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }

    return messages;
  }

  /**
   * Reset the decoder buffer.
   */
  public reset(): void {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Returns current buffered byte length.
   */
  public get bufferedBytes(): number {
    return this.buffer.length;
  }
}
