export interface SensitivePathDecision {
  readonly schemaVersion: 1;
  readonly path: string;
  readonly excluded: boolean;
  readonly ruleId: string | null;
  readonly source: "hard-sensitive-path-policy";
  readonly reason: string;
}

export interface SensitivePathOptions {
  readonly additionalPatterns?: readonly string[];
  readonly allow?: readonly string[];
  readonly unsafeAcknowledged?: boolean;
}

const sensitiveNames = new Set([
  ".netrc",
  "credentials",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);
const sensitiveExtensions = new Set([
  ".key",
  ".pem",
  ".p12",
  ".pfx",
  ".crt",
  ".cer",
]);

function matchesPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === pattern;
}

export function evaluateSensitivePath(
  path: string,
  options: SensitivePathOptions = {},
): SensitivePathDecision {
  const canonical = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
  const segments = canonical.split("/");
  const name = segments.at(-1) ?? "";
  const lowerName = name.toLowerCase();
  const extension = lowerName.includes(".")
    ? `.${lowerName.split(".").at(-1)}`
    : "";

  let ruleId: string | null = null;
  if (/^\.env(?:\.|$)/i.test(name)) ruleId = "sensitive.env";
  else if (sensitiveNames.has(lowerName)) ruleId = "sensitive.credentials";
  else if (sensitiveExtensions.has(extension)) ruleId = "sensitive.key-or-cert";
  else if (
    canonical === ".aws/credentials" ||
    canonical.startsWith(".config/gcloud/") ||
    canonical.startsWith(".azure/")
  )
    ruleId = "sensitive.cloud-config";
  else if (
    options.additionalPatterns?.some((pattern) =>
      matchesPattern(canonical, pattern),
    )
  )
    ruleId = "sensitive.configured";

  const exception = options.allow?.some((pattern) =>
    matchesPattern(canonical, pattern),
  );
  if (ruleId !== null && exception && options.unsafeAcknowledged) {
    return {
      schemaVersion: 1,
      path: canonical,
      excluded: false,
      ruleId,
      source: "hard-sensitive-path-policy",
      reason: "Sensitive path explicitly allowed with unsafe acknowledgement.",
    };
  }

  return {
    schemaVersion: 1,
    path: canonical,
    excluded: ruleId !== null,
    ruleId,
    source: "hard-sensitive-path-policy",
    reason:
      ruleId === null
        ? "Path does not match a high-risk sensitive path rule."
        : "Path is excluded before content acquisition.",
  };
}
