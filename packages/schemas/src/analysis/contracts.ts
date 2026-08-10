import { z } from "zod";

export const NORMALIZED_ANALYSIS_SCHEMA_VERSION = 1 as const;

export const analysisRepositoryIdSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/u);

export const analysisIdentitySchema = z
  .string()
  .regex(/^analysis:[a-z][a-z0-9-]*:[a-f0-9]{64}$/u);

export const analysisPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      path === path.normalize("NFC") &&
      !path.startsWith("/") &&
      !path.includes("\\") &&
      !path.split("/").some((segment) => segment === "." || segment === "..") &&
      !/^[A-Za-z]:/u.test(path),
    { message: "Analysis paths must be canonical repository-relative paths" },
  );

export const analysisPositionSchema = z.strictObject({
  offset: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});

export const analysisRangeSchema = z
  .strictObject({
    start: analysisPositionSchema,
    end: analysisPositionSchema,
  })
  .refine(({ end, start }) => end.offset >= start.offset, {
    message: "Analysis range end must not precede start",
    path: ["end", "offset"],
  });

export const analysisEvidenceBasisSchema = z.enum([
  "observed",
  "parsed",
  "inferred",
  "configured",
]);

export const analysisCompletenessSchema = z.enum([
  "complete",
  "partial",
  "unsupported",
  "failed",
  "stale",
  "verified",
]);

export const analysisResolutionSchema = z.enum([
  "resolved",
  "unresolved",
  "ambiguous",
  "not-applicable",
]);

const scopedIdentitySchema = z.strictObject({
  id: analysisIdentitySchema,
  repositoryId: analysisRepositoryIdSchema,
});

export const analysisFileSchema = scopedIdentitySchema.extend({
  kind: z.literal("file"),
  path: analysisPathSchema,
  language: z.string().min(1),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
});

export const analysisModuleSchema = scopedIdentitySchema.extend({
  kind: z.enum(["module", "package"]),
  name: z.string().min(1),
  path: analysisPathSchema.nullable(),
});

export const analysisSymbolSchema = scopedIdentitySchema.extend({
  kind: z.enum([
    "class",
    "interface",
    "type",
    "function",
    "method",
    "property",
    "variable",
    "constant",
    "namespace",
    "module",
    "test",
    "endpoint",
    "schema",
  ]),
  name: z.string().min(1),
  fileId: analysisIdentitySchema,
  range: analysisRangeSchema,
  exported: z.boolean(),
});

export const analysisProvenanceSchema = z.strictObject({
  sourceFileId: analysisIdentitySchema,
  sourceSymbolId: analysisIdentitySchema.nullable(),
  range: analysisRangeSchema.nullable(),
  basis: analysisEvidenceBasisSchema,
  parserIdentity: z.string().min(1),
  analysisIdentity: z.string().min(1),
  confidence: z.number().min(0).max(1),
  resolution: analysisResolutionSchema,
});

export const analysisRelationshipSchema = scopedIdentitySchema.extend({
  kind: z.enum([
    "import",
    "export",
    "reference",
    "call",
    "inheritance",
    "test",
    "endpoint",
    "schema",
    "configuration-link",
  ]),
  sourceId: analysisIdentitySchema,
  targetId: analysisIdentitySchema.nullable(),
  unresolvedTarget: z.string().min(1).max(1024).nullable(),
  provenance: analysisProvenanceSchema,
});

export const normalizedAnalysisSchema = z
  .strictObject({
    schemaVersion: z.literal(NORMALIZED_ANALYSIS_SCHEMA_VERSION),
    repositoryId: analysisRepositoryIdSchema,
    analysisIdentity: z.string().min(1),
    files: z.array(analysisFileSchema).max(100_000),
    modules: z.array(analysisModuleSchema).max(100_000),
    symbols: z.array(analysisSymbolSchema).max(500_000),
    relationships: z.array(analysisRelationshipSchema).max(1_000_000),
    completeness: analysisCompletenessSchema,
    diagnostics: z.array(z.string().min(1).max(8192)).max(128),
  })
  .superRefine((record, context) => {
    for (const [collectionName, collection] of [
      ["files", record.files],
      ["modules", record.modules],
      ["symbols", record.symbols],
      ["relationships", record.relationships],
    ] as const) {
      collection.forEach((item, index) => {
        if (item.repositoryId !== record.repositoryId) {
          context.addIssue({
            code: "custom",
            message: "Analysis identities cannot cross repository roots",
            path: [collectionName, index, "repositoryId"],
          });
        }
      });
    }
  });

export type AnalysisRange = z.infer<typeof analysisRangeSchema>;
export type AnalysisEvidenceBasis = z.infer<typeof analysisEvidenceBasisSchema>;
export type AnalysisCompleteness = z.infer<typeof analysisCompletenessSchema>;
export type AnalysisFile = z.infer<typeof analysisFileSchema>;
export type AnalysisModule = z.infer<typeof analysisModuleSchema>;
export type AnalysisSymbol = z.infer<typeof analysisSymbolSchema>;
export type AnalysisRelationship = z.infer<typeof analysisRelationshipSchema>;
export type NormalizedAnalysis = z.infer<typeof normalizedAnalysisSchema>;

export function parseNormalizedAnalysis(value: unknown): NormalizedAnalysis {
  return normalizedAnalysisSchema.parse(value);
}

export function serializeNormalizedAnalysis(value: unknown): string {
  const parsed = parseNormalizedAnalysis(value);
  const byId = <T extends { readonly id: string }>(left: T, right: T) =>
    left.id.localeCompare(right.id);
  return `${JSON.stringify({
    ...parsed,
    files: [...parsed.files].sort(byId),
    modules: [...parsed.modules].sort(byId),
    symbols: [...parsed.symbols].sort(byId),
    relationships: [...parsed.relationships].sort(byId),
  })}\n`;
}
