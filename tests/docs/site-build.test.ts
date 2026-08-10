import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildDocsSite } from "../../scripts/docs-build.mjs";
import { checkDocs } from "../../scripts/docs-check.mjs";

const root = resolve(import.meta.dirname, "../..");

const digestTree = async (directory: string) => {
  const files: string[] = [];
  const visit = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  };
  await visit(directory);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(directory, file).replaceAll("\\", "/"));
    hash.update(await readFile(file));
  }
  return hash.digest("hex");
};

describe("local documentation site", () => {
  it("builds deterministic local-only production output", async () => {
    const output = await mkdtemp(join(tmpdir(), "fuzit-docs-output-"));
    await buildDocsSite({ root, output });
    const first = await digestTree(output);
    await buildDocsSite({ root, output });
    expect(await digestTree(output)).toBe(first);
    const index = await readFile(resolve(output, "README.html"), "utf8");
    expect(index).not.toMatch(
      /<(?:script|img|link)[^>]+(?:src|href)=["']https?:\/\//i,
    );
    expect(index).not.toContain("<script");
  });

  it("validates the checked-in public documentation surface", async () => {
    await expect(checkDocs({ root })).resolves.toMatchObject({ pages: 10 });
  });

  it("rejects private references and malformed examples", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "fuzit-docs-fixture-"));
    await mkdir(resolve(fixture, "docs/getting-started"), { recursive: true });
    await writeFile(
      resolve(fixture, "docs/navigation.json"),
      JSON.stringify({
        schemaVersion: 1,
        sections: [{ title: "Invalid", path: "getting-started/README.md" }],
      }),
    );
    await writeFile(resolve(fixture, "docs/README.md"), "# Fixture\n");
    await writeFile(resolve(fixture, "docs/OWNERSHIP.md"), "# Ownership\n");
    await writeFile(
      resolve(fixture, "docs/getting-started/README.md"),
      "# Invalid\n\n`.v1-development/state.json`\n\n```json\n{invalid}\n```\n",
    );
    await expect(checkDocs({ root: fixture })).rejects.toThrow(
      /forbidden public reference|invalid JSON example/,
    );
  });
});
