import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("V1 migration and rebuild notes", () => {
  it("documents every required compatibility and rollback decision", async () => {
    const text = await readFile(
      resolve(root, "docs/release/migrations.md"),
      "utf8",
    );
    for (const phrase of [
      "Private baseline to V1",
      "Reader compatibility",
      "Inspect and rebuild local state",
      "No silent migration",
      "Rollback limits",
      "unsupported-future-version",
      "fuzit.config.json",
      "graph stats",
      "--no-index",
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it("uses rebuild commands exercised by the packed CLI smoke test", async () => {
    const [notes, smoke] = await Promise.all([
      readFile(resolve(root, "docs/release/migrations.md"), "utf8"),
      readFile(resolve(root, "scripts/package-smoke.mjs"), "utf8"),
    ]);
    for (const command of ["verify", "rebuild"]) {
      expect(notes).toContain(`fuzit cache ${command}`);
      expect(smoke).toContain(`"cache", "${command}"`);
    }
    expect(smoke).toContain('"--dry-run"');
  });
});
