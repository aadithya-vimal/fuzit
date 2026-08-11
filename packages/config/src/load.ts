import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";

const configValuesSchema = z
  .object({
    outputFormat: z.enum(["markdown", "json", "xml", "text"]),
    maxFiles: z.number().int().positive(),
    diagnosticLevel: z.enum(["error", "warning", "info", "debug"]),
    include: z.array(z.string().min(1)),
    exclude: z.array(z.string().min(1)),
  })
  .strict();

const repositoryConfigSchema = configValuesSchema.partial().strict();

export function validateRepositoryConfig(input: unknown): boolean {
  return repositoryConfigSchema.safeParse(input).success;
}

export type ConfigValues = z.infer<typeof configValuesSchema>;
export type ConfigKey = keyof ConfigValues;
export type ConfigSource = "default" | "repository" | "environment" | "cli";
export type ConfigOverrides = Partial<Record<ConfigKey, unknown>>;
export type ConfigProvenance = Record<ConfigKey, ConfigSource>;

export interface ConfigLoadInput {
  readonly repositoryRoot: string;
  readonly configPath?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly cli?: ConfigOverrides;
}

export interface EffectiveConfig {
  readonly schemaVersion: 1;
  readonly values: ConfigValues;
  readonly provenance: ConfigProvenance;
}

export const DEFAULT_CONFIG: Readonly<ConfigValues> = Object.freeze({
  outputFormat: "markdown",
  maxFiles: 120,
  diagnosticLevel: "info",
  include: [],
  exclude: [],
});

export const CONFIG_ENVIRONMENT_VARIABLES = Object.freeze({
  outputFormat: "FUZIT_OUTPUT_FORMAT",
  maxFiles: "FUZIT_MAX_FILES",
  diagnosticLevel: "FUZIT_DIAGNOSTIC_LEVEL",
} satisfies Record<"outputFormat" | "maxFiles" | "diagnosticLevel", string>);

export class ConfigLoadError extends Error {
  readonly code: "CONFIG.INVALID" | "CONFIG.OUTSIDE_REPOSITORY";
  readonly issues: readonly string[];

  constructor(
    code: ConfigLoadError["code"],
    message: string,
    issues: readonly string[] = [],
  ) {
    super(message);
    this.name = "ConfigLoadError";
    this.code = code;
    this.issues = issues;
  }
}

function assertInsideRepository(
  repositoryRoot: string,
  configPath: string,
): void {
  const pathFromRoot = relative(repositoryRoot, configPath);

  if (
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..\\`) ||
    pathFromRoot.startsWith("../") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new ConfigLoadError(
      "CONFIG.OUTSIDE_REPOSITORY",
      "Configuration must be located inside the repository.",
    );
  }
}

function formatIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path =
      issue.path.length === 0 ? "configuration" : issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
}

async function readRepositoryConfig(
  configPath: string,
): Promise<ConfigOverrides> {
  let contents: string;

  try {
    contents = await readFile(configPath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    throw new ConfigLoadError(
      "CONFIG.INVALID",
      "Unable to read repository configuration.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents.replace(/^\uFEFF/, ""));
  } catch {
    throw new ConfigLoadError(
      "CONFIG.INVALID",
      "Repository configuration must contain valid JSON.",
    );
  }

  const result = repositoryConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigLoadError(
      "CONFIG.INVALID",
      "Repository configuration is invalid.",
      formatIssues(result.error),
    );
  }

  return result.data;
}

function readEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ConfigOverrides {
  const outputFormat = environment[CONFIG_ENVIRONMENT_VARIABLES.outputFormat];
  const maxFiles = environment[CONFIG_ENVIRONMENT_VARIABLES.maxFiles];
  const diagnosticLevel =
    environment[CONFIG_ENVIRONMENT_VARIABLES.diagnosticLevel];

  return {
    ...(outputFormat === undefined ? {} : { outputFormat }),
    ...(maxFiles === undefined ? {} : { maxFiles: Number(maxFiles) }),
    ...(diagnosticLevel === undefined ? {} : { diagnosticLevel }),
  };
}

function applyLayer(
  values: ConfigOverrides,
  provenance: ConfigProvenance,
  layer: ConfigOverrides,
  source: ConfigSource,
): void {
  for (const key of Object.keys(layer) as ConfigKey[]) {
    const value = layer[key];
    if (value !== undefined) {
      values[key] = value;
      provenance[key] = source;
    }
  }
}

export async function loadEffectiveConfig(
  input: ConfigLoadInput,
): Promise<EffectiveConfig> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const configPath = resolve(
    input.configPath ?? resolve(repositoryRoot, "fuzit.config.json"),
  );

  assertInsideRepository(repositoryRoot, configPath);
  if (extname(configPath).toLowerCase() !== ".json") {
    throw new ConfigLoadError(
      "CONFIG.INVALID",
      "Repository configuration must use the .json file extension.",
    );
  }

  const values: ConfigOverrides = { ...DEFAULT_CONFIG };
  const provenance: ConfigProvenance = {
    outputFormat: "default",
    maxFiles: "default",
    diagnosticLevel: "default",
    include: "default",
    exclude: "default",
  };

  applyLayer(
    values,
    provenance,
    await readRepositoryConfig(configPath),
    "repository",
  );
  applyLayer(
    values,
    provenance,
    readEnvironment(input.environment ?? {}),
    "environment",
  );
  applyLayer(values, provenance, input.cli ?? {}, "cli");

  const result = configValuesSchema.safeParse(values);
  if (!result.success) {
    throw new ConfigLoadError(
      "CONFIG.INVALID",
      "Effective configuration is invalid.",
      formatIssues(result.error),
    );
  }

  return {
    schemaVersion: 1,
    values: result.data,
    provenance,
  };
}
