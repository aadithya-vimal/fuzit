import { z } from "zod";

export const DIAGNOSTIC_SCHEMA_VERSION = 1 as const;

export const severitySchema = z.enum(["info", "warning", "error"]);

export type Severity = z.infer<typeof severitySchema>;

export const sourceLocationSchema = z
  .strictObject({
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
  })
  .refine(({ column, line }) => column === undefined || line !== undefined, {
    message: "column requires line",
    path: ["column"],
  });

export type SourceLocation = z.infer<typeof sourceLocationSchema>;

export const diagnosticSchema = z.strictObject({
  schemaVersion: z.literal(DIAGNOSTIC_SCHEMA_VERSION),
  code: z.string().regex(/^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/),
  severity: severitySchema,
  source: z.string().min(1),
  message: z.string().min(1),
  remediation: z.string().min(1).optional(),
  location: sourceLocationSchema.optional(),
});

export type Diagnostic = z.infer<typeof diagnosticSchema>;

export function parseDiagnostic(input: unknown): Diagnostic {
  return diagnosticSchema.parse(input);
}

export function serializeDiagnostic(diagnostic: Diagnostic): string {
  const validated = parseDiagnostic(diagnostic);
  return JSON.stringify(validated);
}
