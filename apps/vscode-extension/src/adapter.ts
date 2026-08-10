import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { redactSensitiveText } from "@fuzit/security";

const execFileAsync = promisify(execFile);

export interface EngineAdapterOptions {
  readonly cliPath?: string;
  readonly cwd?: string;
  readonly signal?: AbortSignal;
}

export interface EngineAdapterResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Executes Fuzit engine commands safely using explicit argument arrays.
 * Never uses shell: true or string concatenation to prevent argument injection.
 */
export async function executeEngineCommand(
  args: readonly string[],
  options: EngineAdapterOptions = {},
): Promise<EngineAdapterResult> {
  const binary = options.cliPath ?? "fuzit";
  const cwd = options.cwd ?? process.cwd();

  // Validate argument elements to ensure no dangerous types
  for (const arg of args) {
    if (typeof arg !== "string") {
      throw new TypeError("Engine command arguments must all be strings");
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(binary, [...args], {
      cwd,
      signal: options.signal,
      shell: false, // Strict: no shell invocation
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      exitCode: 0,
      stdout: redactSensitiveText(stdout.toString()),
      stderr: redactSensitiveText(stderr.toString()),
    };
  } catch (error: unknown) {
    const err = error as {
      code?: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (err.code === "ENOENT") {
      throw new Error(
        redactSensitiveText(`Fuzit CLI binary not found at "${binary}"`),
        { cause: error },
      );
    }
    return {
      exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
      stdout: redactSensitiveText((err.stdout ?? "").toString()),
      stderr: redactSensitiveText(
        (err.stderr ?? err.message ?? String(error)).toString(),
      ),
    };
  }
}
