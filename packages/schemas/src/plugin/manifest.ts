import { z } from "zod";

export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1 as const;

/**
 * Valid plugin capability identifier.
 */
export const pluginCapabilitySchema = z.enum([
  "provider",
  "parser",
  "collector",
  "renderer",
  "policy",
  "profile",
  "secret-detector",
  "ranker",
  "graph-enricher",
]);

export type PluginCapability = z.infer<typeof pluginCapabilitySchema>;

/**
 * Path string validator preventing path traversal, absolute paths, and null bytes.
 */
function isSafeRelativePath(pathStr: string): boolean {
  if (!pathStr || typeof pathStr !== "string") return false;
  if (pathStr.includes("\0")) return false;
  if (pathStr.includes("..")) return false;
  if (pathStr.startsWith("/") || pathStr.startsWith("\\")) return false;
  if (/^[a-zA-Z]:[/\\]/.test(pathStr)) return false;
  return true;
}

const safeRelativePathSchema = z
  .string()
  .min(1)
  .refine((val) => isSafeRelativePath(val), {
    message:
      "Path must be a safe relative path without leading slash, drive letter, or '..' traversal",
  });

/**
 * Plugin permission configuration schema (deny by default).
 */
export const pluginPermissionsSchema = z
  .strictObject({
    filesystem: z
      .strictObject({
        readPaths: z.array(safeRelativePathSchema).optional(),
        writePaths: z.array(safeRelativePathSchema).optional(),
      })
      .optional(),
    network: z
      .strictObject({
        allowedHosts: z
          .array(
            z
              .string()
              .min(1)
              .regex(/^[a-zA-Z0-9.-]+$/, {
                message:
                  "allowedHosts must be valid hostnames without scheme or path",
              }),
          )
          .optional(),
      })
      .optional(),
    shell: z.boolean().optional().default(false),
    environment: z
      .strictObject({
        allowedVars: z
          .array(
            z
              .string()
              .min(1)
              .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
                message: "Environment variable names must be valid identifiers",
              }),
          )
          .optional(),
      })
      .optional(),
    credentials: z
      .strictObject({
        allowedKeys: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    persistence: z.boolean().optional().default(false),
  })
  .optional();

export type PluginPermissions = z.infer<typeof pluginPermissionsSchema>;

/**
 * Signed metadata / integrity placeholder schema.
 */
export const pluginIntegritySchema = z.strictObject({
  checksum: z.string().min(1).optional(),
  signature: z.string().min(1).optional(),
  algorithm: z.string().min(1).optional(),
});

export type PluginIntegrity = z.infer<typeof pluginIntegritySchema>;

/**
 * Plugin output schema declaration.
 */
export const pluginOutputSchemaItemSchema = z.strictObject({
  type: z.string().min(1),
  schemaVersion: z.number().int().positive(),
});

export type PluginOutputSchemaItem = z.infer<
  typeof pluginOutputSchemaItemSchema
>;

/**
 * Semver string validation helper (matches standard semver like 1.0.0, 0.1.0-alpha.1).
 */
const semverRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Compatible range string helper (e.g. >=1.0.0 <2.0.0, ^1.0.0, ~1.2.0, 1.0.0).
 */
const semverRangeRegex =
  /^[~^>=<]*\s*\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\s+[~^>=<]*\s*\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)*$/;

/**
 * Plugin manifest schema.
 */
export const pluginManifestSchema = z.strictObject({
  schemaVersion: z
    .literal(PLUGIN_MANIFEST_SCHEMA_VERSION)
    .default(PLUGIN_MANIFEST_SCHEMA_VERSION),
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/, {
      message:
        "Plugin ID must consist of lowercase alphanumeric segments separated by dots or hyphens (e.g. org.plugin-name)",
    })
    .refine(
      (val) => !val.includes("/") && !val.includes("\\") && !val.includes(".."),
      {
        message:
          "Plugin ID must not contain path delimiters or traversal components",
      },
    ),
  name: z.string().min(1).max(128),
  version: z.string().min(1).regex(semverRegex, {
    message: "Version must be a valid semver string (e.g. 1.0.0)",
  }),
  protocol: z.string().min(1).default("fuzit-plugin-v1"),
  fuzitVersion: z.string().min(1).regex(semverRangeRegex, {
    message:
      "fuzitVersion must be a valid semver version or range (e.g. ^1.0.0 or >=1.0.0 <2.0.0)",
  }),
  entryPoint: safeRelativePathSchema,
  description: z.string().max(512).optional(),
  capabilities: z.array(pluginCapabilitySchema).min(1, {
    message: "Plugin must declare at least one capability",
  }),
  permissions: pluginPermissionsSchema,
  outputSchemas: z.array(pluginOutputSchemaItemSchema).optional(),
  integrity: pluginIntegritySchema.optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function parsePluginManifest(input: unknown): PluginManifest {
  return pluginManifestSchema.parse(input);
}

export function validatePluginManifest(
  input: unknown,
):
  | { success: true; data: PluginManifest }
  | { success: false; errors: string[] } {
  const result = pluginManifestSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

export function serializePluginManifest(manifest: PluginManifest): string {
  const validated = parsePluginManifest(manifest);
  return JSON.stringify(validated, null, 2);
}
