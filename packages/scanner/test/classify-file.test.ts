import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "@fuzit/core";
import { classifyFile } from "../src/index.js";

const directories: string[] = [];
async function fixture(name: string, content: string | Buffer) {
  const root = await mkdtemp(join(tmpdir(), "fuzit-classify-"));
  directories.push(root);
  const absolute = join(root, name);
  await writeFile(absolute, content);
  return { absolute, path: normalizeRepositoryRelativePath(name) };
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("file classification", () => {
  it.each([
    ["component.jsx", "JavaScript"],
    ["styles.css", "CSS"],
    ["config.yaml", "YAML"],
    ["main.rs", "Rust"],
  ])("classifies mainstream file %s", async (name, language) => {
    const file = await fixture(name, "content");
    const result = await classifyFile(file.absolute, file.path);
    expect(result.language.name).toBe(language);
  });

  it("does not classify .gitignore as generated from its patterns", async () => {
    const file = await fixture(".gitignore", "generated/\n");
    const result = await classifyFile(file.absolute, file.path);
    expect(result.generated).toBe(false);
  });

  it("classifies extensionless files conservatively", async () => {
    const file = await fixture("LICENSE", "text");
    await expect(classifyFile(file.absolute, file.path)).resolves.toMatchObject(
      {
        extension: "",
        language: { name: "Unknown", confidence: 0 },
      },
    );
  });
  it("preserves Unicode names", async () => {
    const file = await fixture("文档.ts", "export {}");
    await expect(classifyFile(file.absolute, file.path)).resolves.toMatchObject(
      {
        path: "文档.ts",
        language: { name: "TypeScript" },
      },
    );
  });
  it("reads only a bounded prefix for a large file", async () => {
    const file = await fixture("large.txt", "x");
    let maximum = 0;
    await classifyFile(file.absolute, file.path, {
      readPrefix: async (_path, bytes) => {
        maximum = bytes;
        return Buffer.from("text");
      },
    });
    expect(maximum).toBe(4096);
  });
  it("detects a binary prefix", async () => {
    const file = await fixture("data.bin", Buffer.from([1, 0, 2]));
    await expect(classifyFile(file.absolute, file.path)).resolves.toMatchObject(
      {
        kind: "binary",
      },
    );
  });
  it("detects a generated header", async () => {
    const file = await fixture("generated.ts", "// generated; do not edit\n");
    await expect(classifyFile(file.absolute, file.path)).resolves.toMatchObject(
      {
        generated: true,
      },
    );
  });
  it("detects a vendored canonical path", async () => {
    const file = await fixture("x.js", "");
    await expect(
      classifyFile(
        file.absolute,
        normalizeRepositoryRelativePath("vendor/x.js"),
      ),
    ).resolves.toMatchObject({ vendored: true });
  });
  it("reports an unreadable file", async () => {
    const file = await fixture("private.txt", "private");
    await expect(
      classifyFile(file.absolute, file.path, {
        readPrefix: async () => {
          throw new Error("denied");
        },
      }),
    ).resolves.toMatchObject({ readable: false });
  });
});
