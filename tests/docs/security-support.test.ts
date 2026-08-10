import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../../apps/cli/src/cli.js";

const page = resolve(
  import.meta.dirname,
  "../../docs/security/operational-security.md",
);

async function preview(): Promise<string> {
  let stdout = "";
  const exitCode = await runCli(["support", "--preview"], {
    writeOut: (value) => {
      stdout += value;
    },
    writeErr: () => {
      throw new Error("support preview wrote a diagnostic");
    },
  });
  expect(exitCode).toBe(0);
  return stdout;
}

describe("security, privacy, and support documentation", () => {
  it("matches tested security behavior without absolute guarantees", async () => {
    const source = (await readFile(page, "utf8")).replace(/\s+/g, " ");
    for (const contract of [
      "denied before their contents are opened",
      "cannot guarantee finding every secret",
      "make no network requests",
      "There is no telemetry",
      "does not override repository confinement",
      "blocks release",
      "compromised local operating system",
      "explicit partial results",
    ]) {
      expect(source).toContain(contract);
    }
  });

  it("produces a deterministic metadata-only support preview", async () => {
    const first = await preview();
    expect(await preview()).toBe(first);
    expect(first).toContain('"schemaVersion":1');
    expect(first).toContain('"kind":"fuzit-support-preview"');
    expect(first).toContain('"contentIncluded":false');
    expect(first).not.toContain(process.cwd());
    expect(first).not.toMatch(/(?:password|token|private[-_ ]?key)=/i);
  });

  it("documents private reporting and credential response", async () => {
    const source = await readFile(page, "utf8");
    expect(source).toContain("Do not disclose");
    expect(source).toContain("revoke and rotate");
    expect(source).toContain("minimal inert reproduction");
    expect(source).toContain("There is no support-upload command");
  });
});
