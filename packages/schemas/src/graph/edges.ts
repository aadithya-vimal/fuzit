import { z } from "zod";

import { analysisPathSchema } from "../analysis/contracts.js";
import { graphNodeIdSchema, graphNodeKindSchema } from "./contracts.js";

export const graphEdgeKindSchema = z.enum([
  "contains",
  "imports",
  "exports",
  "references",
  "calls",
  "extends",
  "implements",
  "tests",
  "configures",
  "documents",
  "depends-on",
  "changed-with",
  "introduced-by",
  "modifies",
  "supersedes",
  "generated-from",
]);
export const graphEdgeIdSchema = z.string().regex(/^graph:edge:[a-f0-9]{64}$/u);
export const graphEdgeEvidenceBasisSchema = z.enum([
  "direct",
  "parsed",
  "heuristic",
]);
export const graphEdgeResolutionSchema = z.enum([
  "resolved",
  "unresolved",
  "conflicting",
]);
export const graphEdgeEvidenceSchema = z.strictObject({
  basis: graphEdgeEvidenceBasisSchema,
  collector: z.string().min(1).max(128),
  collectorVersion: z.string().min(1).max(64),
  sourcePath: analysisPathSchema.nullable(),
  reason: z.string().min(1).max(1024),
});
export const graphRevisionValiditySchema = z.strictObject({
  validFrom: z.string().min(1).max(256),
  validThrough: z.string().min(1).max(256).nullable(),
});

const allowedDirections: Readonly<Record<string, readonly string[]>> = {
  contains: [
    "repository:package",
    "repository:file",
    "package:file",
    "file:symbol",
    "file:test",
    "file:endpoint",
    "file:schema-model",
    "file:configuration",
    "file:documentation",
  ],
  imports: ["file:file", "symbol:symbol"],
  exports: ["file:symbol", "package:symbol"],
  calls: ["symbol:symbol", "endpoint:symbol"],
  extends: ["symbol:symbol"],
  implements: ["symbol:symbol"],
  tests: ["test:file", "test:symbol", "test:endpoint"],
  configures: [
    "configuration:package",
    "configuration:file",
    "configuration:symbol",
  ],
  documents: [
    "documentation:package",
    "documentation:file",
    "documentation:symbol",
  ],
  "depends-on": ["package:package", "file:file"],
  "introduced-by": ["file:change", "symbol:change"],
  modifies: ["change:file", "change:symbol"],
  supersedes: ["snapshot:snapshot", "change:change"],
  "generated-from": ["file:file", "documentation:file"],
};

export const graphEdgeSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: graphEdgeIdSchema,
    repositoryId: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    kind: graphEdgeKindSchema,
    sourceId: graphNodeIdSchema,
    sourceKind: graphNodeKindSchema,
    targetId: graphNodeIdSchema.nullable(),
    targetKind: graphNodeKindSchema.nullable(),
    unresolvedTarget: z.string().min(1).max(1024).nullable(),
    resolution: graphEdgeResolutionSchema,
    evidence: z.array(graphEdgeEvidenceSchema).min(1).max(16),
    revision: graphRevisionValiditySchema,
  })
  .superRefine((edge, context) => {
    const unresolved = edge.resolution === "unresolved";
    if (unresolved !== (edge.targetId === null))
      context.addIssue({
        code: "custom",
        message:
          "Unresolved edges require a null target; resolved edges require a target",
        path: ["targetId"],
      });
    if (unresolved !== (edge.targetKind === null))
      context.addIssue({
        code: "custom",
        message: "Target kind must match target resolution",
        path: ["targetKind"],
      });
    if (unresolved !== (edge.unresolvedTarget !== null))
      context.addIssue({
        code: "custom",
        message: "Only unresolved edges require unresolved target evidence",
        path: ["unresolvedTarget"],
      });
    if (edge.targetKind !== null) {
      const directions = allowedDirections[edge.kind];
      if (
        directions &&
        !directions.includes(`${edge.sourceKind}:${edge.targetKind}`)
      )
        context.addIssue({
          code: "custom",
          message: `Invalid ${edge.kind} edge direction`,
          path: ["targetKind"],
        });
    }
  });

export type GraphEdgeKind = z.infer<typeof graphEdgeKindSchema>;
export type GraphEdgeEvidence = z.infer<typeof graphEdgeEvidenceSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export function parseGraphEdge(value: unknown): GraphEdge {
  return graphEdgeSchema.parse(value);
}
