import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../../apps/cli/src/cli.js";

const root = resolve(import.meta.dirname, "../..");

async function help(args: readonly string[]): Promise<string> {
  let output = "";
  const exitCode = await runCli([...args, "--help"], {
    writeOut: (value) => (output += value),
    writeErr: () => undefined,
  });
  expect(exitCode).toBe(0);
  return output;
}

describe("troubleshooting and known limitations", () => {
  it("tests practical recovery commands against live help", async () => {
    const source = await readFile(
      resolve(root, "docs/troubleshooting/README.md"),
      "utf8",
    );
    for (const args of [
      ["cache", "verify"],
      ["cache", "rebuild"],
      ["cache", "purge"],
      ["watch"],
      ["plugin", "doctor"],
      ["support"],
    ] as const) {
      const output = await help(args);
      expect(output).toContain("Usage: fuzit");
      expect(source.replaceAll("fuzit --json ", "fuzit ")).toContain(
        `fuzit ${args.join(" ")}`,
      );
    }
  });

  it("covers every required failure and privacy-safe response", async () => {
    const source = (
      await readFile(resolve(root, "docs/troubleshooting/README.md"), "utf8")
    ).replace(/\s+/g, " ");
    for (const term of [
      "Installation and startup failures",
      "Cache corruption",
      "Watcher uncertainty",
      "partial parsing",
      "Partial graph",
      "Performance and resource limits",
      "MCP errors",
      "VS Code errors",
      "Plugin errors",
      "Uninstall",
      "minimal inert reproduction",
    ])
      expect(source).toContain(term);
  });

  it("distinguishes release blockers from bounded limitations", async () => {
    const source = await readFile(
      resolve(root, "docs/troubleshooting/known-limitations.md"),
      "utf8",
    );
    expect(source).toContain("## Mandatory release blockers");
    expect(source).toContain("## Accepted bounded V1 behavior");
    expect(source).toContain("Publication authorization remains false");
    for (const task of ["V1-149", "V1-152", "V1-160", "V1-161", "V1-162"])
      expect(source).toContain(task);
  });
});
