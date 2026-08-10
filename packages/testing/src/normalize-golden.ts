export interface GoldenNormalizationOptions<
  RecordType extends Record<string, unknown>,
> {
  readonly volatileFields: readonly (keyof RecordType)[];
  readonly rootPath?: string;
}

function replaceAll(
  value: string,
  search: string,
  replacement: string,
): string {
  return value.split(search).join(replacement);
}

function normalizeVolatileString(value: string, rootPath?: string): string {
  let normalized = value.replace(/\r\n?/g, "\n");

  if (rootPath) {
    const slashPath = rootPath.replaceAll("\\", "/");
    const backslashPath = rootPath.replaceAll("/", "\\");

    normalized = replaceAll(normalized, rootPath, "<ROOT>");
    normalized = replaceAll(normalized, slashPath, "<ROOT>");
    normalized = replaceAll(normalized, backslashPath, "<ROOT>");
    normalized = normalized.replaceAll("\\", "/");
  }

  return normalized;
}

export function normalizeGoldenFields<
  RecordType extends Record<string, unknown>,
>(
  record: RecordType,
  options: GoldenNormalizationOptions<RecordType>,
): RecordType {
  const normalized = { ...record };

  for (const field of options.volatileFields) {
    const value = normalized[field];

    if (typeof value === "string") {
      normalized[field] = normalizeVolatileString(
        value,
        options.rootPath,
      ) as RecordType[typeof field];
    }
  }

  return normalized;
}
