import { createHash } from "node:crypto";

import {
  GRAPH_SCHEMA_VERSION,
  parseGraphNode,
  type GraphNode,
  type GraphNodeKind,
  type GraphProvenance,
} from "@fuzit/schemas";

export interface CreateGraphNodeInput {
  readonly repositoryId: string;
  readonly kind: GraphNodeKind;
  readonly identity: string;
  readonly path: string | null;
  readonly parentId: string | null;
  readonly provenance: GraphProvenance;
}

export function createGraphNodeId(
  repositoryId: string,
  kind: GraphNodeKind,
  identity: string,
): string {
  const digest = createHash("sha256")
    .update(`${repositoryId}\0${kind}\0${identity.normalize("NFC")}`)
    .digest("hex");
  return `graph:node:${digest}`;
}

export function createGraphNode(input: CreateGraphNodeInput): GraphNode {
  return parseGraphNode({
    schemaVersion: GRAPH_SCHEMA_VERSION,
    ...input,
    identity: input.identity.normalize("NFC"),
    path: input.path?.normalize("NFC") ?? null,
    id: createGraphNodeId(input.repositoryId, input.kind, input.identity),
  });
}
