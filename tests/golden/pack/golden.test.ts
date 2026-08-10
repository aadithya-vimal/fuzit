import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runCli } from "../../../apps/cli/src/cli.js";
import { createContextBundle } from "@fuzit/core";

async function pack(root: string): Promise<string> {
  let stdout = "";
  const exitCode = await runCli(
    ["pack", "--root", root, "--format", "markdown", "--output", "-"],
    { writeOut: (value) => (stdout += value), writeErr: () => {} },
    { repositoryRoot: root, environment: {} },
  );
  expect(exitCode).toBe(0);
  return stdout;
}

describe("pack golden gate", () => {
  it("is byte-identical across repeated runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-golden-"));
    await writeFile(join(root, "a.txt"), "alpha\n");
    expect(await pack(root)).toBe(await pack(root));
  });

  it("does not emit synthetic secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-golden-"));
    const value = ["SYNTHETIC", "SECRET", "VALUE", "123456"].join("_");
    await writeFile(join(root, "a.txt"), `token=${value}`);
    expect(await pack(root)).not.toContain(value);
  });

  it("tolerates CRLF checkout content deterministically", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-golden-"));
    await writeFile(join(root, "a.txt"), "one\r\ntwo\r\n");
    expect(await pack(root)).toBe(await pack(root));
  });

  it("sorts diagnostics", async () => {
    const bundle = createContextBundle({
      schemaVersion: 1,
      source: { kind: "repository", root: "." },
      revision: null,
      items: [],
      redactionSummary: { findings: 0, redactedItems: 0, omittedItems: 0 },
      warnings: ["zeta", "alpha"],
      failedSources: ["zeta", "alpha"],
      budget: { bytes: 0, tokens: 0, truncated: false },
    });
    expect(bundle.warnings).toEqual(["alpha", "zeta"]);
    expect(bundle.failedSources).toEqual(["alpha", "zeta"]);
  });
});
