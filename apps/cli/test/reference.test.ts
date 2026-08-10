import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli.js";

async function help(arguments_: readonly string[]): Promise<string> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli([...arguments_, "--help"], {
    writeOut: (value) => {
      stdout += value;
    },
    writeErr: (value) => {
      stderr += value;
    },
  });
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  return stdout;
}

describe("core CLI reference", () => {
  it("tracks every documented core command and option", async () => {
    const reference = await readFile(
      resolve(import.meta.dirname, "../../../docs/reference/cli.md"),
      "utf8",
    );
    const surfaces = [
      { args: [], tokens: ["--version", "--json", "--quiet", "--debug"] },
      { args: ["init"], tokens: ["--dry-run", "--force"] },
      {
        args: ["scan"],
        tokens: [
          "--root",
          "--list-roots",
          "--paths",
          "--metadata",
          "--items",
          "--content",
          "--summary",
          "--include",
          "--exclude",
          "--explain-path",
        ],
      },
      {
        args: ["pack"],
        tokens: [
          "--format",
          "--output",
          "--root",
          "--dry-run",
          "--git",
          "--since",
        ],
      },
      {
        args: ["context"],
        tokens: [
          "--task",
          "--profile",
          "--budget-tokens",
          "--format",
          "--output",
          "--root",
          "--no-index",
          "--explain",
        ],
      },
      { args: ["diff"], tokens: ["--json", "<snapshot-a>", "<snapshot-b>"] },
    ] as const;

    for (const { args, tokens } of surfaces) {
      const output = await help(args);
      for (const token of tokens) {
        expect(output, `${args.join(" ") || "root"} help`).toContain(token);
        expect(reference, `reference for ${token}`).toContain(token);
      }
    }
  });

  it("names each core command and stable exit code", async () => {
    const reference = await readFile(
      resolve(import.meta.dirname, "../../../docs/reference/cli.md"),
      "utf8",
    );
    const rootHelp = await help([]);
    for (const command of [
      "config",
      "doctor",
      "init",
      "scan",
      "pack",
      "git",
      "cache",
      "snapshot",
      "diff",
      "profile",
      "context",
      "explain",
    ]) {
      expect(rootHelp).toMatch(new RegExp(`\\n  ${command}(?: |\\n)`));
      expect(reference).toContain(`fuzit ${command}`);
    }
    for (const code of [0, 2, 3, 4, 70, 130]) {
      expect(reference).toContain(`| \`${code}\` |`);
    }
  });
});
