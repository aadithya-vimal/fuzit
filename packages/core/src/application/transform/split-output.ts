/**
 * Output splitting and size parsing utilities.
 *
 * @module
 */

import { extname } from "node:path";

export interface OutputChunk {
  readonly filename: string;
  readonly path: string;
  readonly content: string;
  readonly bytes: number;
}

/**
 * Parse a human-readable size string like "500kb", "1mb", "100000" into bytes.
 */
export function parseByteSize(sizeSpec: string): number {
  const normalized = sizeSpec.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (!match) {
    throw new Error(`Invalid size specification: '${sizeSpec}'. Use formats like 500kb, 1mb, or 100000.`);
  }

  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!;

  if (unit === "" || unit === "b" || unit === "bytes") return Math.round(value);
  if (unit === "k" || unit === "kb") return Math.round(value * 1024);
  if (unit === "m" || unit === "mb") return Math.round(value * 1024 * 1024);
  if (unit === "g" || unit === "gb") return Math.round(value * 1024 * 1024 * 1024);

  throw new Error(`Unknown size unit '${unit}' in '${sizeSpec}'. Supported units: B, KB, MB, GB.`);
}

/**
 * Split rendered markdown bundle content into multiple chunks of at most `maxBytes`.
 */
export function splitPackedOutput(
  content: string,
  outputPath: string,
  maxBytes: number,
): OutputChunk[] {
  if (maxBytes <= 0 || Buffer.byteLength(content, "utf8") <= maxBytes) {
    return [
      {
        filename: outputPath,
        path: outputPath,
        content,
        bytes: Buffer.byteLength(content, "utf8"),
      },
    ];
  }

  const ext = extname(outputPath);
  const basePath = outputPath.slice(0, outputPath.length - ext.length);
  const lines = content.split("\n");
  const chunks: OutputChunk[] = [];

  let currentLines: string[] = [];
  let currentBytes = 0;
  let partIndex = 1;

  for (const line of lines) {
    const lineBytes = Buffer.byteLength(`${line}\n`, "utf8");
    if (currentLines.length > 0 && currentBytes + lineBytes > maxBytes) {
      const partPath = `${basePath}_part${partIndex}${ext}`;
      const chunkText = `${currentLines.join("\n")}\n`;
      chunks.push({
        filename: `${basePath}_part${partIndex}${ext}`,
        path: partPath,
        content: chunkText,
        bytes: Buffer.byteLength(chunkText, "utf8"),
      });
      partIndex += 1;
      currentLines = [];
      currentBytes = 0;
    }
    currentLines.push(line);
    currentBytes += lineBytes;
  }

  if (currentLines.length > 0) {
    const partPath = `${basePath}_part${partIndex}${ext}`;
    const chunkText = `${currentLines.join("\n")}\n`;
    chunks.push({
      filename: `${basePath}_part${partIndex}${ext}`,
      path: partPath,
      content: chunkText,
      bytes: Buffer.byteLength(chunkText, "utf8"),
    });
  }

  return chunks;
}
