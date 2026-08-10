import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { copyFixture } from "./copy-fixture.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("copyFixture", () => {
  it("copies the minimal fixture to a temporary directory", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "fuzit-fixture-"));
    temporaryDirectories.push(temporaryDirectory);

    const packageDirectory = dirname(fileURLToPath(import.meta.url));
    const source = join(
      packageDirectory,
      "..",
      "..",
      "..",
      "fixtures",
      "minimal-empty",
    );
    const target = join(temporaryDirectory, "fixture");

    await copyFixture(source, target);

    await expect(readFile(join(target, ".gitkeep"), "utf8")).resolves.toBe(
      "\n",
    );
  });
});
