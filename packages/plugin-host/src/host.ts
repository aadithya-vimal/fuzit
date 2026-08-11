import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  encodePluginFrame,
  parsePluginManifest,
  PLUGIN_PROTOCOL_VERSION,
  PluginFrameDecoder,
  type Diagnostic,
  type PluginCapability,
  type PluginExecuteResponse,
  type PluginHandshakeResponse,
  type PluginManifest,
  type PluginMessage,
} from "@fuzit/plugin-sdk";
import { validatePluginCompatibility } from "./compatibility.js";
import { enforceDiagnosticLimits } from "./resource-limits.js";
import { redactSensitiveText } from "@fuzit/security";

export interface PluginHostOptions {
  readonly pluginDir: string;
  readonly manifestPath?: string;
  readonly nodeExecutable?: string;
  readonly defaultTimeoutMs?: number;
}

export interface PluginExecutionResult {
  readonly success: boolean;
  readonly data?: unknown | undefined;
  readonly error?: string | undefined;
  readonly diagnostics?: readonly Diagnostic[] | undefined;
}

export class PluginClient {
  private process: ChildProcess;
  private decoder: PluginFrameDecoder;
  private manifest: PluginManifest;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: PluginMessage) => void;
      reject: (reason: Error) => void;
      timer?: NodeJS.Timeout;
    }
  >();
  private requestCounter = 0;
  private isAlive = true;

  constructor(process: ChildProcess, manifest: PluginManifest) {
    this.process = process;
    this.manifest = manifest;
    this.decoder = new PluginFrameDecoder();

    if (this.process.stdout) {
      this.process.stdout.on("data", (chunk: Buffer) => {
        try {
          const messages = this.decoder.push(chunk);
          for (const msg of messages) {
            this.handleIncomingMessage(msg);
          }
        } catch (err) {
          this.handleFatalError(
            new Error(
              `Protocol frame decoding failed: ${err instanceof Error ? err.message : String(err)}`,
              { cause: err },
            ),
          );
        }
      });
    }

    this.process.on("exit", (code, signal) => {
      this.isAlive = false;
      const errorMsg = `Plugin process exited unexpectedly with code ${code ?? "unknown"} (signal: ${signal ?? "none"})`;
      this.handleFatalError(new Error(errorMsg));
    });

    this.process.on("error", (err) => {
      this.isAlive = false;
      this.handleFatalError(err);
    });
  }

  public get pluginManifest(): PluginManifest {
    return this.manifest;
  }

  public get running(): boolean {
    return this.isAlive;
  }

  private generateRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  private sendFrame(message: PluginMessage): void {
    if (!this.isAlive || !this.process.stdin || this.process.stdin.destroyed) {
      throw new Error(
        `Cannot send message to plugin '${this.manifest.id}': process is not active.`,
      );
    }
    const buffer = encodePluginFrame(message);
    this.process.stdin.write(buffer);
  }

  private handleIncomingMessage(message: PluginMessage): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      this.pendingRequests.delete(message.requestId);
      pending.resolve(message);
    }
  }

  private handleFatalError(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  public async performHandshake(
    timeoutMs = 5000,
  ): Promise<PluginHandshakeResponse> {
    const requestId = this.generateRequestId();
    const handshakeReq: PluginMessage = {
      requestId,
      type: "handshake_request",
      pluginId: this.manifest.id,
      protocolVersion: PLUGIN_PROTOCOL_VERSION,
      requestedCapabilities: this.manifest.capabilities,
      permissions: this.manifest.permissions,
    };

    const response = await this.sendRequest(handshakeReq, timeoutMs);
    if (response.type !== "handshake_response") {
      throw new Error(
        `Expected handshake_response but received '${response.type}'`,
      );
    }
    return response;
  }

  public async executeCapability<C extends PluginCapability>(
    capability: C,
    payload: unknown,
    options?: { timeoutMs?: number },
  ): Promise<PluginExecutionResult> {
    if (!this.manifest.capabilities.includes(capability)) {
      return {
        success: false,
        error: `Capability '${capability}' is not declared in plugin manifest for '${this.manifest.id}'`,
      };
    }

    const requestId = this.generateRequestId();
    const executeReq: PluginMessage = {
      requestId,
      type: "execute_request",
      capability,
      payload,
      timeoutMs: options?.timeoutMs,
    };

    try {
      const response = await this.sendRequest(
        executeReq,
        options?.timeoutMs ?? 10000,
      );
      if (response.type !== "execute_response") {
        return {
          success: false,
          error: `Unexpected response type '${response.type}' received for execute_request`,
        };
      }
      const execRes = response as PluginExecuteResponse;
      return {
        success: execRes.success,
        data: execRes.data,
        error:
          execRes.error === undefined
            ? undefined
            : redactSensitiveText(execRes.error),
        diagnostics: enforceDiagnosticLimits(execRes.diagnostics),
      };
    } catch (err) {
      // Attempt cancellation on request timeout
      this.cancelRequest(requestId).catch(() => {});
      return {
        success: false,
        error: redactSensitiveText(
          `Plugin execution failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      };
    }
  }

  public async cancelRequest(targetRequestId: string): Promise<void> {
    const requestId = this.generateRequestId();
    const cancelReq: PluginMessage = {
      requestId,
      type: "cancel_request",
      targetRequestId,
    };
    this.sendFrame(cancelReq);
  }

  public async shutdown(timeoutMs = 3000): Promise<void> {
    if (!this.isAlive) return;

    try {
      const requestId = this.generateRequestId();
      const shutdownReq: PluginMessage = {
        requestId,
        type: "shutdown_request",
      };
      await this.sendRequest(shutdownReq, timeoutMs);
    } catch {
      // Ignore shutdown errors during cleanup
    } finally {
      this.kill();
    }
  }

  public kill(): void {
    this.isAlive = false;
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill("SIGKILL");
        }
      }, 500);
    }
  }

  private sendRequest(
    message: PluginMessage,
    timeoutMs: number,
  ): Promise<PluginMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(
          new Error(
            `Plugin request '${message.requestId}' timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.pendingRequests.set(message.requestId, { resolve, reject, timer });

      try {
        this.sendFrame(message);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(message.requestId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

export class PluginHost {
  /**
   * Spawns an out-of-process plugin worker over stdio.
   */
  public static async spawnPlugin(
    options: PluginHostOptions,
  ): Promise<PluginClient> {
    const resolvedDir = resolve(options.pluginDir);
    const manifestPath = options.manifestPath
      ? resolve(options.manifestPath)
      : join(resolvedDir, "fuzit-plugin.json");

    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = parsePluginManifest(
      JSON.parse(manifestContent.replace(/^\uFEFF/, "")),
    );

    const compatResult = validatePluginCompatibility(manifest);
    if (!compatResult.compatible) {
      throw new Error(
        `Plugin '${manifest.id}' is incompatible: ${compatResult.reasons.join("; ")}`,
      );
    }

    const entryPointPath = join(resolvedDir, manifest.entryPoint);
    const nodeBin = options.nodeExecutable ?? process.execPath;

    // Launch plugin by argument array without invoking a shell
    const child = spawn(nodeBin, [entryPointPath], {
      cwd: resolvedDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        NODE_ENV: "production",
      },
    });

    const client = new PluginClient(child, manifest);

    // Perform initial handshake
    const handshakeResult = await client.performHandshake(
      options.defaultTimeoutMs ?? 5000,
    );
    if (!handshakeResult.success) {
      client.kill();
      throw new Error(
        `Plugin handshake failed for '${manifest.id}': ${handshakeResult.error ?? "Unknown handshake rejection"}`,
      );
    }

    return client;
  }
}
