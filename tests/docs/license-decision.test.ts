import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public license decision record", () => {
  it("compares the required options across every decision criterion", async () => {
    const decision = await readFile(
      resolve(root, "docs/decisions/LICENSE-STRATEGY.md"),
      "utf8",
    );
    for (const required of [
      "MIT",
      "Apache License 2.0",
      "Proprietary, all rights reserved",
      "Patent terms",
      "Commercial use",
      "Contributions",
      "Dependency compatibility",
      "Product strategy",
    ]) {
      expect(decision).toContain(required);
    }
  });

  it("records final MIT with subsequent owner publication authorization", async () => {
    const [decision, license, state] = await Promise.all([
      readFile(resolve(root, "docs/decisions/LICENSE-STRATEGY.md"), "utf8"),
      readFile(resolve(root, "LICENSE"), "utf8"),
      readFile(resolve(root, "docs/release/release-state.json"), "utf8"),
    ]);
    expect(decision).toContain("Apply **MIT** for Fuzit V1");
    expect(decision).toContain("**Approved 2026-08-09: MIT.**");
    expect(decision).toContain("dependency-license audit");
    expect(license).toContain("MIT License");
    expect(license).toContain("Copyright (c) 2026 Aadithya Vimal");
    expect(JSON.parse(state)).toMatchObject({ publicationAuthorized: true });
  });
});
