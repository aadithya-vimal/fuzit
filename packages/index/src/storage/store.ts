import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { LOCAL_INDEX_SCHEMA_VERSION } from "@fuzit/schemas";
import type { IndexIdentitySet } from "../invalidation/identities.js";

export interface LocalIndexMetadata {
  readonly schemaVersion: typeof LOCAL_INDEX_SCHEMA_VERSION;
  readonly repositoryId: string;
  readonly createdAt: string;
}

export interface LocalIndexStore {
  readonly directory: string;
  readonly metadata: LocalIndexMetadata;
}

export interface LocalIndexSemanticState {
  readonly contentHash: string;
  readonly configHash: string;
  readonly scannerVersion: string;
  readonly parserVersion: string;
  readonly securityPolicyVersion: string;
  readonly schemaVersion: number;
  readonly identities?: IndexIdentitySet;
}

const METADATA_FILE = "index.json";
const LOCK_FILE = "index.lock";
const SEMANTIC_FILE = "semantic.json";

function parseMetadata(raw: string): LocalIndexMetadata {
  const value = JSON.parse(raw) as Partial<LocalIndexMetadata>;
  if (
    value.schemaVersion !== LOCAL_INDEX_SCHEMA_VERSION ||
    typeof value.repositoryId !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Corrupt or incompatible local index metadata.");
  }
  return value as LocalIndexMetadata;
}

export async function openLocalIndex(
  directory: string,
  repositoryId: string,
): Promise<LocalIndexStore> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadataPath = join(directory, METADATA_FILE);

  try {
    const metadata = parseMetadata(await readFile(metadataPath, "utf8"));
    if (metadata.repositoryId !== repositoryId) {
      throw new Error("Local index belongs to a different repository.");
    }
    return { directory, metadata };
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      throw error;
    }
  }

  const lockPath = join(directory, LOCK_FILE);
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Local index is locked by another writer.", {
        cause: error,
      });
    }
    throw error;
  }

  const temporaryPath = join(directory, `${METADATA_FILE}.${randomUUID()}.tmp`);
  try {
    const metadata: LocalIndexMetadata = {
      schemaVersion: LOCAL_INDEX_SCHEMA_VERSION,
      repositoryId,
      createdAt: new Date().toISOString(),
    };
    await writeFile(temporaryPath, `${JSON.stringify(metadata)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, metadataPath);
    return { directory, metadata };
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
    await rm(temporaryPath, { force: true });
  }
}

export async function assertIndexLocation(directory: string): Promise<void> {
  const parent = dirname(directory);
  const parentStat = await stat(parent);
  if (!parentStat.isDirectory()) {
    throw new Error("Local index parent is not a directory.");
  }
}

export async function inspectLocalIndex(
  directory: string,
  repositoryId: string,
): Promise<
  | { readonly kind: "absent" }
  | { readonly kind: "locked"; readonly lockOwner: string }
  | { readonly kind: "schema-mismatch"; readonly schemaVersion: number }
  | { readonly kind: "repository-mismatch" }
  | { readonly kind: "corrupt" }
  | { readonly kind: "ready"; readonly schemaVersion: number }
> {
  try {
    await stat(join(directory, LOCK_FILE));
    return { kind: "locked", lockOwner: "local-index-writer" };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      return { kind: "corrupt" };
  }
  try {
    const raw = JSON.parse(
      await readFile(join(directory, METADATA_FILE), "utf8"),
    ) as Partial<LocalIndexMetadata>;
    if (typeof raw.schemaVersion !== "number") return { kind: "corrupt" };
    if (raw.schemaVersion !== LOCAL_INDEX_SCHEMA_VERSION)
      return { kind: "schema-mismatch", schemaVersion: raw.schemaVersion };
    if (raw.repositoryId !== repositoryId)
      return { kind: "repository-mismatch" };
    if (typeof raw.createdAt !== "string") return { kind: "corrupt" };
    return { kind: "ready", schemaVersion: raw.schemaVersion };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return { kind: "absent" };
    return { kind: "corrupt" };
  }
}

export async function writeLocalIndexSemanticState(
  directory: string,
  state: LocalIndexSemanticState,
): Promise<void> {
  const target = join(directory, SEMANTIC_FILE);
  const temporary = join(directory, `${SEMANTIC_FILE}.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(state)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporary, target);
}

export async function readLocalIndexSemanticState(
  directory: string,
): Promise<LocalIndexSemanticState | undefined> {
  try {
    return JSON.parse(
      await readFile(join(directory, SEMANTIC_FILE), "utf8"),
    ) as LocalIndexSemanticState;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
}
