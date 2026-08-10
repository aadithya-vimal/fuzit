import { tmpdir } from "node:os";
import { join } from "node:path";

export function osUserCacheDir(): string {
  if (process.env["FUZIT_CACHE_DIR"]) {
    return process.env["FUZIT_CACHE_DIR"];
  }
  if (process.platform === "win32") {
    return (
      process.env["LOCALAPPDATA"] ??
      join(process.env["USERPROFILE"] ?? tmpdir(), "AppData", "Local")
    );
  }
  if (process.platform === "darwin") {
    return join(process.env["HOME"] ?? tmpdir(), "Library", "Caches");
  }
  return (
    process.env["XDG_CACHE_HOME"] ??
    join(process.env["HOME"] ?? tmpdir(), ".cache")
  );
}
