import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public documentation navigation", () => {
  it("exposes every required area in deterministic order", async () => {
    const navigation = JSON.parse(
      await readFile(resolve(root, "docs/navigation.json"), "utf8"),
    ) as { sections: { title: string; path: string }[] };
    expect(navigation.sections.map(({ title }) => title)).toEqual([
      "Getting started",
      "Guides",
      "Reference",
      "Concepts",
      "Security",
      "Integrations",
      "Troubleshooting",
      "Release policies",
    ]);
    for (const section of navigation.sections) {
      await expect(
        access(resolve(root, "docs", section.path)),
      ).resolves.toBeUndefined();
    }
  });

  it("keeps public navigation free of private execution evidence", async () => {
    const navigation = await readFile(
      resolve(root, "docs/navigation.json"),
      "utf8",
    );
    expect(navigation).not.toMatch(
      /\.v1-development|\.fuzit-development|implementation-plan/,
    );
  });

  it("maps every public area to existing normative specification custody", async () => {
    const ownership = await readFile(
      resolve(root, "docs/OWNERSHIP.md"),
      "utf8",
    );
    for (const path of [
      "specs/01-product",
      "specs/02-architecture",
      "specs/03-cli",
      "specs/04-features",
      "specs/05-engineering",
    ]) {
      expect(ownership).toContain(path);
      await expect(access(resolve(root, path))).resolves.toBeUndefined();
    }
  });

  it("resolves every local link in the public navigation pages", async () => {
    const navigation = JSON.parse(
      await readFile(resolve(root, "docs/navigation.json"), "utf8"),
    ) as { sections: { path: string }[] };
    const pages = [
      "README.md",
      "OWNERSHIP.md",
      ...navigation.sections.map(({ path }) => path),
    ];
    for (const page of pages) {
      const absolute = resolve(root, "docs", page);
      const source = await readFile(absolute, "utf8");
      for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1]?.split("#")[0];
        if (!target || target.startsWith("http")) continue;
        await expect(
          access(resolve(dirname(absolute), target)),
        ).resolves.toBeUndefined();
      }
    }
  });
});
