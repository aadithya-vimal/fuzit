import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { redactSensitiveText } from "@fuzit/security";

export interface GitProcessResult {
  readonly ok: boolean;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
  readonly error?: string;
}

export interface GitProcessOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly maximumBytes?: number;
  readonly signal?: AbortSignal;
  readonly executable?: string;
  readonly spawnProcess?: typeof spawn;
}

function sanitize(value: string): string {
  const redacted = redactSensitiveText(value).replace(/\r?\n/g, " ");
  return [...redacted]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join("");
}

export async function runGit(
  arguments_: readonly string[],
  options: GitProcessOptions = {},
): Promise<GitProcessResult> {
  const maximumBytes = options.maximumBytes ?? 1024 * 1024;
  const spawnOptions: SpawnOptionsWithoutStdio = {
    cwd: options.cwd,
    shell: false,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  };
  return new Promise((resolve) => {
    let settled = false;
    let stdout: Uint8Array = new Uint8Array();
    let stderr: Uint8Array = new Uint8Array();
    let timedOut = false;
    let cancelled = false;
    let child;
    try {
      child = (options.spawnProcess ?? spawn)(
        options.executable ?? "git",
        [...arguments_],
        spawnOptions,
      );
    } catch (error) {
      resolve({
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        cancelled: false,
        error: sanitize(error instanceof Error ? error.message : String(error)),
      });
      return;
    }
    const append = (current: Uint8Array, chunk: Uint8Array): Uint8Array =>
      Buffer.concat([current, chunk]).subarray(0, maximumBytes);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    const finish = (exitCode: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve({
        ok: exitCode === 0 && !timedOut && !cancelled && error === undefined,
        exitCode,
        stdout: Buffer.from(stdout).toString("utf8"),
        stderr: sanitize(Buffer.from(stderr).toString("utf8")),
        timedOut,
        cancelled,
        ...(error === undefined ? {} : { error: sanitize(error) }),
      });
    };
    const abort = () => {
      cancelled = true;
      child.kill();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? 10_000);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    child.on("error", (error) => finish(null, error.message));
    child.on("close", (code) => finish(code));
  });
}

export async function detectGitCapability(): Promise<boolean> {
  return (await runGit(["--version"], { timeoutMs: 2_000 })).ok;
}

export { collectGitIdentity } from "./identity/index.js";
export * from "./status/index.js";
export * from "./history/index.js";
export * from "./diff/index.js";
export * from "./file-history/index.js";
export * from "./remote/safe-transport.js";
export * from "./remote/cache-manager.js";
export * from "./remote/cache-path.js";
export * from "./remote/revision-resolver.js";
export * from "./remote/offline-fallback.js";
export * from "./remote/remote-inference.js";
