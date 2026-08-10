import { z } from "zod";

import {
  analysisEvidenceBasisSchema,
  analysisPathSchema,
  analysisRangeSchema,
  analysisRepositoryIdSchema,
} from "../analysis/contracts.js";

export const GRAPH_SCHEMA_VERSION = 1 as const;

export const graphNodeKindSchema = z.enum([
  "repository",
  "package",
  "file",
  "symbol",
  "test",
  "endpoint",
  "schema-model",
  "configuration",
  "documentation",
  "snapshot",
  "change",
]);

export const graphNodeIdSchema = z.string().regex(/^graph:node:[a-f0-9]{64}$/u);

export const graphProvenanceSchema = z.strictObject({
  collector: z.string().min(1).max(128),
  collectorVersion: z.string().min(1).max(64),
  basis: analysisEvidenceBasisSchema,
  revision: z.string().min(1).max(256),
  sourcePath: analysisPathSchema.nullable(),
  sourceRange: analysisRangeSchema.nullable(),
});

export const graphNodeSchema = z
  .strictObject({
    schemaVersion: z.literal(GRAPH_SCHEMA_VERSION),
    id: graphNodeIdSchema,
    repositoryId: analysisRepositoryIdSchema,
    kind: graphNodeKindSchema,
    identity: z.string().min(1).max(4096),
    path: analysisPathSchema.nullable(),
    parentId: graphNodeIdSchema.nullable(),
    provenance: graphProvenanceSchema,
  })
  .superRefine((node, context) => {
    if (node.kind === "repository" && node.parentId !== null) {
      context.addIssue({
        code: "custom",
        message: "Repository graph nodes cannot have a parent",
        path: ["parentId"],
      });
    }
    if (node.kind !== "repository" && node.parentId === null) {
      context.addIssue({
        code: "custom",
        message: "Non-repository graph nodes require a parent",
        path: ["parentId"],
      });
    }
  });

export type GraphNodeKind = z.infer<typeof graphNodeKindSchema>;
export type GraphProvenance = z.infer<typeof graphProvenanceSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;

export function parseGraphNode(value: unknown): GraphNode {
  return graphNodeSchema.parse(value);
}
