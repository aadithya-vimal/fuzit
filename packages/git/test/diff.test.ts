import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectGitDiff, normalizeGitDiff } from "../src/index.js";

describe("safe Git diff", () => {
  it("marks binary, rename, and deleted-file patches", () => {
    const patch =
      "Binary files a.png and b.png differ\nrename from old.ts\nrename to new.ts\ndeleted file mode 100644\n";
    const result = normalizeGitDiff(patch, ["new.ts", "gone.ts"], {
      maximumBytes: 1000,
      maximumFiles: 10,
    });
    expect(result.binary).toBe(true);
    expect(result.patch).toContain("rename from");
    expect(result.patch).toContain("deleted file mode");
  });

  it("bounds large patches and file counts", () => {
    const result = normalizeGitDiff("x".repeat(1000), ["b", "a", "c"], {
      maximumBytes: 32,
      maximumFiles: 2,
    });
    expect(Buffer.byteLength(result.patch)).toBeLessThanOrEqual(32);
    expect(result.paths).toEqual(["a", "b"]);
    expect(result.truncated).toBe(true);
  });

  it("redacts secrets introduced in a diff", () => {
    const secret = ["SYNTHETIC", "SECRET", "VALUE", "123456"].join("_");
    const result = normalizeGitDiff(`+token=${secret}`, ["a.ts"], {
      maximumBytes: 1000,
      maximumFiles: 10,
    });
    expect(result.patch).not.toContain(secret);
    expect(result.findings).toBeGreaterThan(0);
  });

  it("reports an invalid revision without throwing", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-diff-"));
    expect(
      await collectGitDiff(root, { base: "invalid-revision" }),
    ).toMatchObject({ available: false, patch: "" });
  });
});
