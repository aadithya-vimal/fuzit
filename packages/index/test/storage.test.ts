import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openLocalIndex } from "../src/index.js";

async function location(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "fuzit-index-")), "index");
}

describe("atomic local index storage", () => {
  it("allows concurrent opens to observe one initialized index", async () => {
    const directory = await location();
    const outcomes = await Promise.allSettled([
      openLocalIndex(directory, "repo"),
      openLocalIndex(directory, "repo"),
    ]);
    expect(outcomes.some((outcome) => outcome.status === "fulfilled")).toBe(
      true,
    );
    expect(await openLocalIndex(directory, "repo")).toMatchObject({
      metadata: { schemaVersion: 1, repositoryId: "repo" },
    });
  });

  it("ignores a crash-left temporary file", async () => {
    const directory = await location();
    await openLocalIndex(directory, "repo");
    await writeFile(join(directory, "index.json.crash.tmp"), "partial");
    expect(
      (await openLocalIndex(directory, "repo")).metadata.repositoryId,
    ).toBe("repo");
  });

  it("creates the versioned schema atomically", async () => {
    const directory = await location();
    await openLocalIndex(directory, "repo");
    expect(
      JSON.parse(await readFile(join(directory, "index.json"), "utf8")),
    ).toMatchObject({ schemaVersion: 1, repositoryId: "repo" });
  });

  it("fails safely when the location cannot be created", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-index-blocked-"));
    const blocker = join(root, "file");
    await writeFile(blocker, "not a directory");
    await expect(
      openLocalIndex(join(blocker, "index"), "repo"),
    ).rejects.toThrow();
  });

  it("detects corrupt metadata without replacing it", async () => {
    const directory = await location();
    await openLocalIndex(directory, "repo");
    await writeFile(join(directory, "index.json"), "{bad json");
    await expect(openLocalIndex(directory, "repo")).rejects.toThrow();
    expect(await readFile(join(directory, "index.json"), "utf8")).toBe(
      "{bad json",
    );
  });
});
