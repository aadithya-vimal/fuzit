import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalIndexFileRecordSchema,
  serializeIncrementalIndexRecord,
  type IncrementalIndexRecord,
} from "@fuzit/schemas";

export type CanonicalIndexFileRecord = Extract<
  IncrementalIndexRecord,
  { readonly recordType: "file" }
>;

const FILE_RECORDS_FILE = "files.jsonl";

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function canonicalizeRecords(
  records: readonly CanonicalIndexFileRecord[],
): CanonicalIndexFileRecord[] {
  const validated = records.map((record) =>
    canonicalIndexFileRecordSchema.parse(record),
  );
  validated.sort((left, right) => compareUtf8(left.path, right.path));

  for (let index = 1; index < validated.length; index += 1) {
    if (validated[index - 1]?.path === validated[index]?.path) {
      throw new Error(
        `Duplicate canonical file record: ${validated[index]?.path}`,
      );
    }
  }

  return validated;
}

export async function writeCanonicalFileRecords(
  directory: string,
  records: readonly CanonicalIndexFileRecord[],
): Promise<void> {
  const canonical = canonicalizeRecords(records);
  const serialized = canonical.map(serializeIncrementalIndexRecord).join("");
  await mkdir(directory, { recursive: true, mode: 0o700 });

  const target = join(directory, FILE_RECORDS_FILE);
  const temporary = join(directory, `${FILE_RECORDS_FILE}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, serialized, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readCanonicalFileRecords(
  directory: string,
): Promise<CanonicalIndexFileRecord[]> {
  let serialized: string;
  try {
    serialized = await readFile(join(directory, FILE_RECORDS_FILE), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const records = serialized
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => canonicalIndexFileRecordSchema.parse(JSON.parse(line)));
  return canonicalizeRecords(records);
}
