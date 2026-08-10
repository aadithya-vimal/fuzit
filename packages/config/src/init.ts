import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { DEFAULT_CONFIG, validateRepositoryConfig } from "./load.js";

export const INIT_CONFIG_CONTENT = `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`;
export const INIT_IGNORE_ENTRIES = Object.freeze([
  ".fuzit/",
  ".fuzit-index/",
  ".fuzit/local/",
]);

export type InitAction = "create" | "replace" | "append";

export interface InitChange {
  readonly path: "fuzit.config.json" | ".gitignore";
  readonly action: InitAction;
  readonly content?: string;
  readonly lines?: readonly string[];
}

export interface InitPlan {
  readonly schemaVersion: 1;
  readonly status: "changes-planned" | "no-change";
  readonly changes: readonly InitChange[];
}

export interface InitFileSystem {
  readonly readText: (path: string) => Promise<string | undefined>;
  readonly createText: (path: string, contents: string) => Promise<void>;
  readonly replaceText: (path: string, contents: string) => Promise<void>;
  readonly appendText: (path: string, contents: string) => Promise<void>;
}

export interface PlanInitInput {
  readonly repositoryRoot: string;
  readonly force?: boolean;
  readonly fileSystem?: InitFileSystem;
}

export class InitConflictError extends Error {
  readonly code = "INIT.CONFLICT";

  constructor() {
    super(
      "Existing fuzit.config.json is incompatible; rerun with --force to replace it.",
    );
    this.name = "InitConflictError";
  }
}

async function defaultReadText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

const defaultFileSystem: InitFileSystem = {
  readText: defaultReadText,
  createText: async (path, contents) => {
    await writeFile(path, contents, { encoding: "utf8", flag: "wx" });
  },
  replaceText: async (path, contents) => {
    await writeFile(path, contents, { encoding: "utf8", flag: "w" });
  },
  appendText: async (path, contents) => {
    await appendFile(path, contents, { encoding: "utf8" });
  },
};

function missingIgnoreEntries(contents: string | undefined): readonly string[] {
  const existing = new Set(
    (contents ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  return INIT_IGNORE_ENTRIES.filter((entry) => !existing.has(entry));
}

export async function planInitialization(
  input: PlanInitInput,
): Promise<InitPlan> {
  const fileSystem = input.fileSystem ?? defaultFileSystem;
  const configPath = resolve(input.repositoryRoot, "fuzit.config.json");
  const ignorePath = resolve(input.repositoryRoot, ".gitignore");
  const [configContents, ignoreContents] = await Promise.all([
    fileSystem.readText(configPath),
    fileSystem.readText(ignorePath),
  ]);
  const changes: InitChange[] = [];

  if (configContents === undefined) {
    changes.push({
      path: "fuzit.config.json",
      action: "create",
      content: INIT_CONFIG_CONTENT,
    });
  } else {
    let compatible: boolean;
    try {
      compatible = validateRepositoryConfig(JSON.parse(configContents));
    } catch {
      compatible = false;
    }

    if (!compatible) {
      if (!input.force) {
        throw new InitConflictError();
      }
      changes.push({
        path: "fuzit.config.json",
        action: "replace",
        content: INIT_CONFIG_CONTENT,
      });
    }
  }

  const missingEntries = missingIgnoreEntries(ignoreContents);
  if (missingEntries.length > 0) {
    changes.push({
      path: ".gitignore",
      action: ignoreContents === undefined ? "create" : "append",
      lines: missingEntries,
    });
  }

  return {
    schemaVersion: 1,
    status: changes.length === 0 ? "no-change" : "changes-planned",
    changes,
  };
}

function appendedIgnoreText(
  existingContents: string | undefined,
  lines: readonly string[],
): string {
  const prefix =
    existingContents === undefined || existingContents.length === 0
      ? ""
      : existingContents.endsWith("\n")
        ? ""
        : "\n";
  return `${prefix}${lines.join("\n")}\n`;
}

export async function applyInitialization(
  input: PlanInitInput,
  plan: InitPlan,
): Promise<void> {
  const fileSystem = input.fileSystem ?? defaultFileSystem;

  for (const change of plan.changes) {
    const path = resolve(input.repositoryRoot, change.path);

    if (change.path === "fuzit.config.json" && change.content !== undefined) {
      if (change.action === "create") {
        await fileSystem.createText(path, change.content);
      } else {
        await fileSystem.replaceText(path, change.content);
      }
      continue;
    }

    if (change.path === ".gitignore" && change.lines !== undefined) {
      if (change.action === "create") {
        await fileSystem.createText(
          path,
          appendedIgnoreText(undefined, change.lines),
        );
      } else {
        const existingContents = await fileSystem.readText(path);
        await fileSystem.appendText(
          path,
          appendedIgnoreText(existingContents, change.lines),
        );
      }
    }
  }
}
