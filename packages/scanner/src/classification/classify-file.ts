import { open, lstat } from "node:fs/promises";
import { extname } from "node:path";

import type { RepositoryRelativePath } from "@fuzit/core";
import type { FileRecord } from "@fuzit/schemas";

const PREFIX_BYTES = 4096;

const languages: Readonly<Record<string, string>> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".json": "JSON",
  ".md": "Markdown",
  ".mdx": "Markdown",
  ".py": "Python",
  ".go": "Go",
  ".java": "Java",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".html": "HTML",
  ".xml": "XML",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".rs": "Rust",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".cpp": "C++",
  ".c": "C",
  ".h": "C/C++ Header",
  ".sh": "Shell",
  ".ps1": "PowerShell",
  ".sql": "SQL",
};

export interface ClassifyFileOptions {
  readonly readPrefix?: (
    path: string,
    maximumBytes: number,
  ) => Promise<Uint8Array>;
}

async function defaultReadPrefix(path: string, maximumBytes: number) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(maximumBytes);
    const { bytesRead } = await handle.read(buffer, 0, maximumBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function classifyFile(
  absolutePath: string,
  path: RepositoryRelativePath,
  options: ClassifyFileOptions = {},
): Promise<FileRecord> {
  const metadata = await lstat(absolutePath);
  const symlink = metadata.isSymbolicLink();
  const extension = extname(path);
  let prefix: Uint8Array = new Uint8Array();
  let readable = true;
  if (!symlink && metadata.isFile()) {
    try {
      prefix = await (options.readPrefix ?? defaultReadPrefix)(
        absolutePath,
        PREFIX_BYTES,
      );
    } catch {
      readable = false;
    }
  }
  const binary = prefix.includes(0);
  const prefixText = binary ? "" : Buffer.from(prefix).toString("utf8");
  const languageName = languages[extension.toLowerCase()] ?? "Unknown";
  return {
    schemaVersion: 1,
    path,
    kind: symlink
      ? "symlink"
      : binary
        ? "binary"
        : metadata.isFile()
          ? "text"
          : "other",
    extension,
    language: {
      name: languageName,
      confidence: languageName === "Unknown" ? 0 : 0.8,
    },
    sizeBytes: metadata.size,
    symlink,
    generated:
      !path.endsWith(".gitignore") &&
      /(?:^|\W)generated(?:\W|$)|do not edit/i.test(prefixText),
    vendored: path
      .split("/")
      .some((segment) =>
        ["vendor", "vendors", "third_party"].includes(segment),
      ),
    readable,
  };
}
