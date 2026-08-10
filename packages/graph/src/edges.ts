import { createHash } from "node:crypto";
import {
  parseGraphEdge,
  type GraphEdge,
  type GraphEdgeKind,
} from "@fuzit/schemas";

export type CreateGraphEdgeInput = Omit<GraphEdge, "id" | "schemaVersion">;
export function createGraphEdgeId(
  repositoryId: string,
  kind: GraphEdgeKind,
  sourceId: string,
  targetIdentity: string,
): string {
  const digest = createHash("sha256")
    .update(
      `${repositoryId}\0${kind}\0${sourceId}\0${targetIdentity.normalize("NFC")}`,
    )
    .digest("hex");
  return `graph:edge:${digest}`;
}
export function createGraphEdge(input: CreateGraphEdgeInput): GraphEdge {
  const targetIdentity = input.targetId ?? input.unresolvedTarget ?? "";
  return parseGraphEdge({
    schemaVersion: 1,
    ...input,
    unresolvedTarget: input.unresolvedTarget?.normalize("NFC") ?? null,
    id: createGraphEdgeId(
      input.repositoryId,
      input.kind,
      input.sourceId,
      targetIdentity,
    ),
  });
}
