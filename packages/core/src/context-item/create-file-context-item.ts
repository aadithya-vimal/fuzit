import type { FileContextItem, FileRecord } from "@fuzit/schemas";

import { sha256Hex } from "../hash/index.js";

export function createFileContextItem(
  record: FileRecord,
  content: {
    readonly status: FileContextItem["contentStatus"];
    readonly content: string | null;
    readonly sha256: string;
  },
): FileContextItem {
  return {
    schemaVersion: 1,
    id: `file:${sha256Hex(Buffer.from(record.path, "utf8"))}`,
    kind: "file",
    path: record.path,
    content: content.content,
    contentStatus: content.status,
    provenance: {
      source: "scanner",
      confidenceBasis: "filesystem metadata and bounded content acquisition",
    },
    lifecycle: record.vendored
      ? "vendored"
      : record.generated
        ? "generated"
        : "source",
    sensitivity: "unclassified",
    sha256: content.sha256,
    transformations: [
      "canonical-path",
      ...(content.status === "truncated" ? ["bounded-truncation"] : []),
      ...(content.content === null ? ["content-omitted"] : []),
    ],
  };
}
