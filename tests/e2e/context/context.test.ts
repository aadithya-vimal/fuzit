import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../../../apps/cli/src/cli.js";

async function context(
  root: string,
  output: string,
  profile: string,
  options: readonly string[] = [],
) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    [
      "context",
      "--root",
      root,
      "--task",
      "investigate authentication changes tests and dependencies",
      "--profile",
      profile,
      "--budget-tokens",
      "4000",
      "--format",
      "json",
      "--output",
      output,
      ...options,
    ],
    {
      writeOut: (value) => {
        stdout += value;
      },
      writeErr: (value) => {
        stderr += value;
      },
    },
    { repositoryRoot: root, environment: {} },
  );
  return {
    exitCode,
    stdout,
    stderr,
    report: JSON.parse(await readFile(output, "utf8")) as {
      selected: { path: string; content: string }[];
      excluded: { path: string; reason: string }[];
      evidence?: { path: string; score: number; weights: object }[];
      index: string;
    },
  };
}

describe("task context CLI", () => {
  it("omits sensitive paths and redacts credentials before every renderer", async () => {
    const base = await mkdtemp(join(tmpdir(), "fuzit-context-"));
    const root = join(base, "repository");
    await mkdir(root);
    const secret = "SYNTHETIC_SECRET_VALUE_123456";
    await writeFile(join(root, ".env"), `TOKEN=${secret}\n`);
    await writeFile(
      join(root, "authentication.ts"),
      `export const token = "${secret}";\n`,
    );
    for (const format of ["json", "markdown", "text", "xml"] as const) {
      const output = join(base, `context.${format}`);
      let stderr = "";
      const exitCode = await runCli(
        [
          "context",
          "--root",
          root,
          "--task",
          "audit authentication token handling",
          "--profile",
          "security-audit",
          "--budget-tokens",
          "2000",
          "--format",
          format,
          "--output",
          output,
          "--explain",
          "--no-index",
        ],
        {
          writeOut: () => {},
          writeErr: (value) => {
            stderr += value;
          },
        },
        { repositoryRoot: root, environment: {} },
      );
      const rendered = await readFile(output, "utf8");
      expect(exitCode, stderr).toBe(0);
      expect(rendered).not.toContain(secret);
      expect(rendered).not.toContain(`TOKEN=${secret}`);
      if (format === "json") {
        const parsed = JSON.parse(rendered) as {
          selected: { path: string; content: string }[];
          excluded: { path: string; reason: string }[];
          evidence: { path: string; redacted: boolean }[];
        };
        expect(parsed.selected.some(({ path }) => path === ".env")).toBe(false);
        expect(parsed.excluded).toContainEqual({
          path: ".env",
          reason: "sensitive.env",
        });
        expect(parsed.selected[0]?.content).toContain("[REDACTED:");
        expect(parsed.evidence.some(({ redacted }) => redacted)).toBe(true);
      }
    }
  });

  it("applies profile weights and honors --no-index without mutation", async () => {
    const base = await mkdtemp(join(tmpdir(), "fuzit-context-"));
    const root = join(base, "repository");
    const cache = join(base, "cache");
    await mkdir(root);
    await writeFile(
      join(root, "authentication.ts"),
      "export const authentication = true;\n",
    );
    await writeFile(
      join(root, "package.json"),
      '{"dependencies":{"express":"1"},"devDependencies":{"vitest":"1"}}\n',
    );
    const bug = await context(root, join(base, "bug.json"), "bug-fix", [
      "--explain",
      "--no-index",
    ]);
    const architecture = await context(
      root,
      join(base, "architecture.json"),
      "architecture-review",
      ["--explain", "--no-index"],
    );
    expect(bug.exitCode).toBe(0);
    expect(architecture.exitCode).toBe(0);
    expect(bug.report.evidence).not.toEqual(architecture.report.evidence);
    expect(bug.report.index).toBe("bypassed");
    await expect(access(cache)).rejects.toThrow();
  });
});
