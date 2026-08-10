import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { auditLicenses } from "./license-audit.mjs";

describe("dependency license audit", () => {
  it("matches the committed deterministic report", async () => {
    const root = resolve(import.meta.dirname, "..");
    const [actual, expected] = await Promise.all([
      auditLicenses(root),
      import("../docs/release/dependency-license-audit.json", {
        with: { type: "json" },
      }).then((value) => value.default),
    ]);
    expect(actual).toEqual(expected);
  });

  it("fails closed on an unknown critical runtime license", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-license-audit-"));
    await mkdir(resolve(root, "apps/example/node_modules/unknown"), {
      recursive: true,
    });
    await mkdir(resolve(root, "packages"), { recursive: true });
    await writeFile(
      resolve(root, "apps/example/package.json"),
      JSON.stringify({ dependencies: { unknown: "1.0.0" } }),
    );
    await writeFile(
      resolve(root, "apps/example/node_modules/unknown/package.json"),
      JSON.stringify({ name: "unknown", version: "1.0.0" }),
    );
    await writeFile(
      resolve(root, "apps/example/node_modules/unknown/index.js"),
      "export {};\n",
    );
    await expect(auditLicenses(root)).rejects.toThrow(
      /unknown or blocked runtime license/,
    );
  });
});
