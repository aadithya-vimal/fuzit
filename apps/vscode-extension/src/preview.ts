export interface OutputChannelLike {
  appendLine(message: string): void;
  clear(): void;
  show(): void;
}

export interface PreviewRendererOptions {
  readonly workspaceRoot: string;
  readonly maxOutputBytes?: number;
}

const MAX_PREVIEW_BYTES = 512 * 1024; // 512 KB

/**
 * Redact absolute paths in output content, replacing them with <root>.
 */
export function redactAbsolutePaths(
  content: string,
  workspaceRoot: string,
): string {
  if (!workspaceRoot) return content;
  // Normalize separators
  const escaped = workspaceRoot.replace(/[/\\]/g, "[/\\\\]");
  const re = new RegExp(escaped, "g");
  return content.replace(re, "<root>");
}

/**
 * Render a safe, redacted, bounded preview of context/explanation output.
 * Strips absolute paths and enforces an output size cap.
 */
export function renderPreview(
  content: string,
  opts: PreviewRendererOptions,
): string {
  const cap = opts.maxOutputBytes ?? MAX_PREVIEW_BYTES;
  const redacted = redactSensitiveText(
    redactAbsolutePaths(content, opts.workspaceRoot),
    cap + 16,
  );
  const bytes = Buffer.byteLength(redacted, "utf8");
  if (bytes <= cap) return redacted;
  const truncated = Buffer.from(redacted).slice(0, cap).toString("utf8");
  return (
    truncated +
    `\n\n[Output truncated: ${bytes} bytes exceeds limit of ${cap} bytes]`
  );
}

/**
 * Append redacted content to the VS Code output channel.
 */
export function writeToOutputChannel(
  channel: OutputChannelLike,
  content: string,
  opts: PreviewRendererOptions,
): void {
  const preview = renderPreview(content, opts);
  channel.clear();
  channel.appendLine(preview);
  channel.show();
}
import { redactSensitiveText } from "@fuzit/security";
