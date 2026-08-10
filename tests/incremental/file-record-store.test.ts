import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readCanonicalFileRecords,
  writeCanonicalFileRecords,
  type CanonicalIndexFileRecord,
} from "@fuzit/index";

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function record(
  path: string,
  overrides: Partial<CanonicalIndexFileRecord> = {},
): CanonicalIndexFileRecord {
  return {
    recordType: "file",
    schemaVersion: 1,
    path,
    contentHash: hash("a"),
    sizeBytes: 10,
    mtimeMs: 1,
    classification: "text",
    securityDecision: { outcome: "include", reason: "policy allowed" },
    completeness: "complete",
    ...overrides,
  };
}

async function location(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "fuzit-file-records-")), "index");
}

describe("canonical file record persistence", () => {
  it("reconstructs deterministic state in a fresh read", async () => {
    const directory = await location();
    const records = [
      record("src/z.ts"),
      record("src/a.ts", { contentHash: hash("b") }),
    ];

    await writeCanonicalFileRecords(directory, records);

    expect(await readCanonicalFileRecords(directory)).toEqual([
      records[1],
      records[0],
    ]);
    expect(
      await readFile(join(directory, "files.jsonl"), "utf8"),
    ).not.toContain("sourceContent");
  });

  it("persists add and modify, and removes a deleted path", async () => {
    const directory = await location();
    await writeCanonicalFileRecords(directory, [record("old.ts")]);
    await writeCanonicalFileRecords(directory, [
      record("added.ts"),
      record("old.ts", { contentHash: hash("c"), sizeBytes: 20, mtimeMs: 2 }),
    ]);
    await writeCanonicalFileRecords(directory, [record("added.ts")]);

    expect(await readCanonicalFileRecords(directory)).toEqual([
      record("added.ts"),
    ]);
  });

  it("persists binary, oversized, ignored, sensitive, and read-failure facts without content", async () => {
    const directory = await location();
    const records = [
      record("asset.bin", {
        classification: "binary",
        contentHash: hash("b"),
      }),
      record("large.txt", {
        sizeBytes: 10_000_000,
        completeness: "partial",
        securityDecision: {
          outcome: "include",
          reason: "bounded read reached size limit",
        },
      }),
      record("ignored.log", {
        completeness: "unavailable",
        securityDecision: {
          outcome: "exclude",
          reason: "ignore policy excluded path",
        },
      }),
      record(".env", {
        completeness: "unavailable",
        securityDecision: {
          outcome: "exclude",
          reason: "sensitive path excluded before acquisition",
        },
      }),
      record("unreadable.txt", {
        completeness: "unavailable",
        securityDecision: {
          outcome: "exclude",
          reason: "read failed",
        },
      }),
    ];

    await writeCanonicalFileRecords(directory, records);
    const serialized = await readFile(join(directory, "files.jsonl"), "utf8");

    expect(await readCanonicalFileRecords(directory)).toEqual(
      records.toSorted((left, right) =>
        Buffer.compare(
          Buffer.from(left.path, "utf8"),
          Buffer.from(right.path, "utf8"),
        ),
      ),
    );
    expect(serialized).not.toContain("SECRET=");
    expect(serialized).not.toContain('content":');
  });

  it("rejects duplicates, unsafe paths, and corrupt persisted records", async () => {
    const directory = await location();
    await expect(
      writeCanonicalFileRecords(directory, [
        record("same.ts"),
        record("same.ts"),
      ]),
    ).rejects.toThrow("Duplicate canonical file record");
    await expect(
      writeCanonicalFileRecords(directory, [record("../outside.ts")]),
    ).rejects.toThrow();

    await writeCanonicalFileRecords(directory, [record("valid.ts")]);
    await writeFile(
      join(directory, "files.jsonl"),
      `${JSON.stringify({ ...record("valid.ts"), sourceContent: "SECRET=1" })}\n`,
    );
    await expect(readCanonicalFileRecords(directory)).rejects.toThrow();
  });
});
