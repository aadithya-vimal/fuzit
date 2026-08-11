import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../../apps/cli/src/cli.js";
import { EXIT_CODES } from "@fuzit/schemas";

describe("Plugin CLI Commands (V1-107)", () => {
  let tempDir: string;
  let pluginDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fuzit-cli-plugin-test-"));
    pluginDir = join(tempDir, "sample-plugin");
    await writeFile(join(tempDir, "unrelated.txt"), "hello world", "utf-8");

    const manifestContent = JSON.stringify({
      schemaVersion: 1,
      id: "com.example.sample-plugin",
      name: "Sample AST Plugin",
      version: "1.0.0",
      protocol: "fuzit-plugin-v1",
      fuzitVersion: "^1.0.0",
      entryPoint: "dist/plugin.js",
      description: "Sample test plugin",
      capabilities: ["parser"],
      permissions: {
        filesystem: {
          readPaths: ["src/"],
        },
      },
    });

    await (
      await import("node:fs/promises")
    ).mkdir(pluginDir, { recursive: true });
    await writeFile(
      join(pluginDir, "fuzit-plugin.json"),
      manifestContent,
      "utf-8",
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createBufferIo() {
    let out = "";
    let err = "";
    return {
      io: {
        writeOut: (chunk: string) => {
          out += chunk;
        },
        writeErr: (chunk: string) => {
          err += chunk;
        },
      },
      getOut: () => out,
      getErr: () => err,
    };
  }

  it("lists local plugins in text format", async () => {
    const { io, getOut } = createBufferIo();
    const exitCode = await runCli(["plugin", "list", "--dir", tempDir], io, {
      repositoryRoot: tempDir,
    });
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain("Discovered plugins:");
    expect(getOut()).toContain("com.example.sample-plugin@1.0.0");
  });

  it("lists local plugins in JSON format", async () => {
    const { io, getOut } = createBufferIo();
    const exitCode = await runCli(
      ["plugin", "list", "--dir", tempDir, "--json"],
      io,
      { repositoryRoot: tempDir },
    );
    expect(exitCode).toBe(EXIT_CODES.success);
    const parsed = JSON.parse(getOut());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe("com.example.sample-plugin");
  });

  it("inspects a specific plugin by path", async () => {
    const { io, getOut } = createBufferIo();
    const manifestPath = join(pluginDir, "fuzit-plugin.json");
    const exitCode = await runCli(["plugin", "inspect", manifestPath], io, {
      repositoryRoot: tempDir,
    });
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain("Plugin: Sample AST Plugin");
    expect(getOut()).toContain("Capabilities: parser");
  });

  it("accepts a UTF-8 BOM in plugin manifests", async () => {
    const manifestPath = join(pluginDir, "fuzit-plugin.json");
    const original = await (
      await import("node:fs/promises")
    ).readFile(manifestPath, "utf8");
    await writeFile(manifestPath, `\uFEFF${original}`, "utf8");
    const { io, getOut } = createBufferIo();
    const exitCode = await runCli(["plugin", "inspect", manifestPath], io, {
      repositoryRoot: tempDir,
    });
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain("Plugin: Sample AST Plugin");
  });

  it("surfaces malformed discovered manifests", async () => {
    const brokenDir = join(tempDir, "broken-plugin");
    await (await import("node:fs/promises")).mkdir(brokenDir);
    await writeFile(join(brokenDir, "fuzit-plugin.json"), "{broken", "utf8");
    const { io, getErr } = createBufferIo();
    const exitCode = await runCli(["plugin", "list", "--dir", tempDir], io, {
      repositoryRoot: tempDir,
    });
    expect(exitCode).toBe(EXIT_CODES.validation);
    expect(getErr()).toContain("PLUGIN.INVALID_MANIFEST");
    expect(getErr()).toContain("broken-plugin");
  });

  it("validates a valid plugin manifest", async () => {
    const { io, getOut } = createBufferIo();
    const manifestPath = join(pluginDir, "fuzit-plugin.json");
    const exitCode = await runCli(["plugin", "validate", manifestPath], io, {
      repositoryRoot: tempDir,
    });
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain("PASS Plugin manifest");
  });

  it("reports permission audit on enabling a plugin", async () => {
    const { io, getOut } = createBufferIo();
    const exitCode = await runCli(
      ["plugin", "enable", "com.example.sample-plugin"],
      io,
      { repositoryRoot: tempDir },
    );
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain(
      "Plugin 'com.example.sample-plugin' enabled successfully.",
    );
    expect(getOut()).toContain("Granted Permissions Audit:");
  });

  it("disables a local plugin", async () => {
    const { io, getOut } = createBufferIo();
    const exitCode = await runCli(
      ["plugin", "disable", "com.example.sample-plugin"],
      io,
      { repositoryRoot: tempDir },
    );
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain(
      "Plugin 'com.example.sample-plugin' has been disabled.",
    );
  });

  it("runs plugin doctor and audits plugin readiness", async () => {
    const { io, getOut } = createBufferIo();
    const exitCode = await runCli(["plugin", "doctor"], io, {
      repositoryRoot: tempDir,
    });
    expect(exitCode).toBe(EXIT_CODES.success);
    expect(getOut()).toContain("Fuzit plugin doctor");
  });
});
