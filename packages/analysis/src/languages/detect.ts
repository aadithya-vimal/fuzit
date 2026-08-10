import { extname } from "node:path";

import { createRepositoryFact } from "../index.js";

export interface LanguageFile {
  readonly path: string;
  readonly contentPrefix?: string;
  readonly generated?: boolean;
  readonly vendored?: boolean;
}

const extensions: Readonly<Record<string, string>> = {
  ".ts": "TypeScript",
  ".js": "JavaScript",
  ".py": "Python",
  ".java": "Java",
  ".go": "Go",
};

export function detectLanguages(files: readonly LanguageFile[]) {
  return files
    .filter((file) => !file.generated && !file.vendored)
    .flatMap((file) => {
      const extensionLanguage = extensions[extname(file.path).toLowerCase()];
      const shebangLanguage = file.contentPrefix?.startsWith("#!/usr/bin/env ")
        ? file.contentPrefix.slice(15).split(/\s/)[0]
        : undefined;
      const language =
        extensionLanguage ??
        (shebangLanguage === "python"
          ? "Python"
          : shebangLanguage === "node"
            ? "JavaScript"
            : undefined);
      if (!language) return [];
      return [
        createRepositoryFact({
          kind: "language",
          value: language,
          confidence: extensionLanguage ? 0.9 : 0.8,
          basis: "inferred",
          evidence: [file.path],
          detector: extensionLanguage ? "extension" : "shebang",
          conflictsWith: [],
        }),
      ];
    });
}

export function detectSourceRoots(paths: readonly string[]) {
  return [
    ...new Set(
      paths
        .map((path) => path.split("/")[0])
        .filter((root): root is string => root !== undefined && root !== ""),
    ),
  ]
    .filter((root) => ["src", "test", "tests", "app", "lib"].includes(root))
    .sort();
}
