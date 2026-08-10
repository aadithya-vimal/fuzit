import { describe, expect, it } from "vitest";
import {
  MAX_PLUGIN_FRAME_BYTES,
  PluginFrameDecoder,
  encodePluginFrame,
  type PluginMessage,
} from "@fuzit/plugin-sdk";

describe("Framed Plugin Protocol (V1-101)", () => {
  const handshakeMsg: PluginMessage = {
    requestId: "req-1",
    type: "handshake_request",
    pluginId: "com.example.test-plugin",
    protocolVersion: "fuzit-plugin-v1",
    requestedCapabilities: ["parser", "collector"],
    permissions: {
      shell: false,
      persistence: false,
    },
  };

  const executeMsg: PluginMessage = {
    requestId: "req-2",
    type: "execute_request",
    capability: "parser",
    payload: { file: "src/index.ts", content: "const x = 1;" },
    timeoutMs: 5000,
  };

  const shutdownMsg: PluginMessage = {
    requestId: "req-3",
    type: "shutdown_request",
  };

  it("encodes and decodes messages with length prefixing cleanly", () => {
    const frameBuffer = encodePluginFrame(handshakeMsg);
    expect(frameBuffer.length).toBeGreaterThan(4);

    const payloadLength = frameBuffer.readUInt32BE(0);
    expect(payloadLength).toBe(frameBuffer.length - 4);

    const decoder = new PluginFrameDecoder();
    const decoded = decoder.push(frameBuffer);

    expect(decoded.length).toBe(1);
    expect(decoded[0]).toEqual(handshakeMsg);
  });

  it("decodes fragmented message chunks across multiple push calls deterministically", () => {
    const frameBuffer = encodePluginFrame(executeMsg);
    const decoder = new PluginFrameDecoder();

    // Split frame into 3 small fragments
    const part1 = frameBuffer.subarray(0, 5);
    const part2 = frameBuffer.subarray(5, 20);
    const part3 = frameBuffer.subarray(20);

    const res1 = decoder.push(part1);
    expect(res1.length).toBe(0);
    expect(decoder.bufferedBytes).toBe(5);

    const res2 = decoder.push(part2);
    expect(res2.length).toBe(0);
    expect(decoder.bufferedBytes).toBe(20);

    const res3 = decoder.push(part3);
    expect(res3.length).toBe(1);
    expect(res3[0]).toEqual(executeMsg);
    expect(decoder.bufferedBytes).toBe(0);
  });

  it("decodes coalesced multiple frames in a single incoming buffer", () => {
    const frame1 = encodePluginFrame(handshakeMsg);
    const frame2 = encodePluginFrame(executeMsg);
    const frame3 = encodePluginFrame(shutdownMsg);

    const combinedBuffer = Buffer.concat([frame1, frame2, frame3]);
    const decoder = new PluginFrameDecoder();

    const decoded = decoder.push(combinedBuffer);
    expect(decoded.length).toBe(3);
    expect(decoded[0]).toEqual(handshakeMsg);
    expect(decoded[1]).toEqual(executeMsg);
    expect(decoded[2]).toEqual(shutdownMsg);
  });

  it("fails closed on oversized frame headers exceeding MAX_PLUGIN_FRAME_BYTES", () => {
    const oversizedHeader = Buffer.alloc(4);
    oversizedHeader.writeUInt32BE(MAX_PLUGIN_FRAME_BYTES + 1, 0);

    const decoder = new PluginFrameDecoder();
    expect(() => decoder.push(oversizedHeader)).toThrowError(
      /Oversized frame header encountered/,
    );
    expect(decoder.bufferedBytes).toBe(0);
  });

  it("fails closed on malformed JSON payload frame", () => {
    const badPayload = Buffer.from("{ bad json content ", "utf-8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(badPayload.length, 0);

    const badFrame = Buffer.concat([header, badPayload]);
    const decoder = new PluginFrameDecoder();

    expect(() => decoder.push(badFrame)).toThrowError(
      /Failed to parse plugin frame/,
    );
  });

  it("supports cancellation, diagnostic events, and responses", () => {
    const cancelMsg: PluginMessage = {
      requestId: "req-4",
      type: "cancel_request",
      targetRequestId: "req-2",
      reason: "User aborted operation",
    };

    const diagMsg: PluginMessage = {
      requestId: "req-5",
      type: "diagnostic_event",
      diagnostic: {
        schemaVersion: 1,
        code: "PLUGIN_WARN",
        severity: "warning",
        source: "test-plugin",
        message: "Partial symbol table returned",
      },
    };

    const encodedCancel = encodePluginFrame(cancelMsg);
    const encodedDiag = encodePluginFrame(diagMsg);

    const decoder = new PluginFrameDecoder();
    const decoded = decoder.push(Buffer.concat([encodedCancel, encodedDiag]));

    expect(decoded.length).toBe(2);
    expect(decoded[0]).toEqual(cancelMsg);
    expect(decoded[1]).toEqual(diagMsg);
  });
});
