import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const page = resolve(
  import.meta.dirname,
  "../../docs/concepts/incremental-operation.md",
);

describe("incremental operation documentation", () => {
  it("preserves the canonical equivalence and bounded partial-result contract", async () => {
    const source = await readFile(page, "utf8");
    const prose = source.replace(/\s+/g, " ");
    for (const contract of [
      "correctness oracle",
      "must equal a clean calculation",
      "reconciliationRequired",
      "does **not** promise real-time delivery",
      "never presented as perfect knowledge",
      "Depth is capped at 10",
      "results at 1,000 items",
      "does not persist raw source or ASTs",
    ]) {
      expect(prose).toContain(contract);
    }
  });

  it("keeps rebuild and failure guidance explicit", async () => {
    const source = await readFile(page, "utf8");
    const prose = source.replace(/\s+/g, " ");
    for (const state of [
      "ready",
      "locked",
      "corrupt",
      "repository-mismatch",
      "schema-mismatch",
    ]) {
      expect(source).toContain(`\`${state}\``);
    }
    expect(prose).toContain("never silently accept or migrate");
    expect(prose).toContain("Purge only after checking");
  });

  it("validates the documented deterministic diagnostic fixture", async () => {
    const source = await readFile(page, "utf8");
    const fixture = source.match(/```json\n([^\n]+)\n```/)?.[1];
    expect(fixture).toBeDefined();
    expect(JSON.parse(fixture ?? "null")).toEqual({
      schemaVersion: 1,
      state: "schema-mismatch",
      rebuildRequired: true,
      reason: "stored schema is not supported",
    });
  });
});
