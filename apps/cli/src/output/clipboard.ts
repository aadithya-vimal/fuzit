import { execSync } from "node:child_process";

export interface ClipboardResult {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * Copy text to the OS clipboard cross-platform (clip on Windows, pbcopy on macOS, xclip/wl-copy on Linux).
 */
export function copyToClipboard(text: string): ClipboardResult {
  try {
    const platform = process.platform;
    if (platform === "win32") {
      execSync("clip", { input: text, encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] });
      return { ok: true, message: "Copied to clipboard." };
    }
    if (platform === "darwin") {
      execSync("pbcopy", { input: text, encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] });
      return { ok: true, message: "Copied to clipboard." };
    }
    if (platform === "linux") {
      try {
        execSync("wl-copy", { input: text, encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] });
        return { ok: true, message: "Copied to clipboard (wl-clipboard)." };
      } catch {
        execSync("xclip -selection clipboard", { input: text, encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] });
        return { ok: true, message: "Copied to clipboard (xclip)." };
      }
    }
    return { ok: false, message: `Clipboard copy not supported on platform '${platform}'.` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Clipboard copy failed: ${msg}` };
  }
}
