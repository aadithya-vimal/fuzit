import { open, stat } from "node:fs/promises";

import { sha256Hex } from "@fuzit/core";

export interface TextContentResult {
  readonly schemaVersion: 1;
  readonly status: "complete" | "truncated" | "omitted" | "changed";
  readonly encoding: "utf-8" | "utf-16le" | "utf-16be" | "invalid";
  readonly content: string | null;
  readonly bytesRead: number;
  readonly truncated: boolean;
  readonly sha256: string;
}

export async function readTextContent(
  path: string,
  options: {
    readonly maximumBytes?: number;
    readonly signal?: AbortSignal;
  } = {},
): Promise<TextContentResult> {
  const maximumBytes = options.maximumBytes ?? 64 * 1024;
  const before = await stat(path);
  const handle = await open(path, "r");
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (total <= maximumBytes) {
      if (options.signal?.aborted)
        throw new DOMException("Cancelled", "AbortError");
      const buffer = Buffer.alloc(Math.min(8192, maximumBytes + 1 - total));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
      if (total > maximumBytes) {
        truncated = true;
        break;
      }
    }
  } finally {
    await handle.close();
  }
  const bytes = Buffer.concat(chunks).subarray(0, maximumBytes);
  const after = await stat(path);
  const changed =
    before.size !== after.size || before.mtimeMs !== after.mtimeMs;
  let encoding: TextContentResult["encoding"] = "utf-8";
  let body: Uint8Array = bytes;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    body = bytes.subarray(3);
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    body = bytes.subarray(2);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2));
    for (let index = 0; index + 1 < swapped.length; index += 2)
      [swapped[index], swapped[index + 1]] = [
        swapped[index + 1] ?? 0,
        swapped[index] ?? 0,
      ];
    body = swapped;
    encoding = "utf-16le";
  }
  let content: string | null;
  try {
    content = new TextDecoder(encoding, { fatal: true }).decode(body);
  } catch {
    encoding = "invalid";
    content = null;
  }
  return {
    schemaVersion: 1,
    status: changed
      ? "changed"
      : content === null
        ? "omitted"
        : truncated
          ? "truncated"
          : "complete",
    encoding,
    content,
    bytesRead: bytes.length,
    truncated,
    sha256: sha256Hex(bytes),
  };
}
