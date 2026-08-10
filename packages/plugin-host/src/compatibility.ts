import {
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  PLUGIN_PROTOCOL_VERSION,
  pluginCapabilitySchema,
  type PluginManifest,
} from "@fuzit/plugin-sdk";

export interface CompatibilityValidationOptions {
  readonly hostVersion?: string;
  readonly supportedProtocol?: string;
}

export interface CompatibilityValidationResult {
  readonly compatible: boolean;
  readonly reasons: readonly string[];
}

/**
 * Checks if a semver string satisfies a version requirement range string.
 */
export function satisfiesSemver(version: string, range: string): boolean {
  const cleanRange = range.trim();
  if (cleanRange === "*" || cleanRange === "") return true;

  const versionMatch = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!versionMatch) return false;

  const vMajor = parseInt(versionMatch[1] ?? "0", 10);
  const vMinor = parseInt(versionMatch[2] ?? "0", 10);
  const vPatch = parseInt(versionMatch[3] ?? "0", 10);

  if (cleanRange.startsWith("^")) {
    const rMatch = /^\^\s*(\d+)\.(\d+)\.(\d+)/.exec(cleanRange);
    if (!rMatch) return false;
    const rMajor = parseInt(rMatch[1] ?? "0", 10);
    const rMinor = parseInt(rMatch[2] ?? "0", 10);

    if (vMajor !== rMajor) return false;
    if (vMinor < rMinor) return false;
    return true;
  }

  if (cleanRange.startsWith("~")) {
    const rMatch = /^~\s*(\d+)\.(\d+)\.(\d+)/.exec(cleanRange);
    if (!rMatch) return false;
    const rMajor = parseInt(rMatch[1] ?? "0", 10);
    const rMinor = parseInt(rMatch[2] ?? "0", 10);

    if (vMajor !== rMajor || vMinor !== rMinor) return false;
    return true;
  }

  if (cleanRange.startsWith(">=")) {
    const rMatch = /^>=\s*(\d+)\.(\d+)\.(\d+)/.exec(cleanRange);
    if (!rMatch) return false;
    const rMajor = parseInt(rMatch[1] ?? "0", 10);
    const rMinor = parseInt(rMatch[2] ?? "0", 10);
    const rPatch = parseInt(rMatch[3] ?? "0", 10);

    if (vMajor > rMajor) return true;
    if (vMajor < rMajor) return false;
    if (vMinor > rMinor) return true;
    if (vMinor < rMinor) return false;
    return vPatch >= rPatch;
  }

  // Exact version match fallback
  const exactMatch = /^(\d+)\.(\d+)\.(\d+)/.exec(cleanRange);
  if (exactMatch) {
    const rMajor = parseInt(exactMatch[1] ?? "0", 10);
    const rMinor = parseInt(exactMatch[2] ?? "0", 10);
    const rPatch = parseInt(exactMatch[3] ?? "0", 10);
    return vMajor === rMajor && vMinor === rMinor && vPatch === rPatch;
  }

  return true;
}

/**
 * Validates protocol, Fuzit host range, capability, schema version, and integrity metadata before activation.
 */
export function validatePluginCompatibility(
  manifest: PluginManifest,
  options?: CompatibilityValidationOptions,
): CompatibilityValidationResult {
  const reasons: string[] = [];
  const hostVersion = options?.hostVersion ?? "1.0.0";
  const supportedProtocol =
    options?.supportedProtocol ?? PLUGIN_PROTOCOL_VERSION;

  // 1. Schema version check
  if (manifest.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    reasons.push(
      `Unsupported manifest schemaVersion '${manifest.schemaVersion}'. Expected '${PLUGIN_MANIFEST_SCHEMA_VERSION}'.`,
    );
  }

  // 2. Protocol version check
  if (manifest.protocol !== supportedProtocol) {
    reasons.push(
      `Incompatible plugin protocol '${manifest.protocol}'. Host supports protocol '${supportedProtocol}'.`,
    );
  }

  // 3. Host Fuzit version range check
  if (!satisfiesSemver(hostVersion, manifest.fuzitVersion)) {
    reasons.push(
      `Plugin '${manifest.id}' requires Fuzit version '${manifest.fuzitVersion}', but current host is '${hostVersion}'.`,
    );
  }

  // 4. Capability validation
  const validCapabilities = new Set(pluginCapabilitySchema.options);
  for (const cap of manifest.capabilities) {
    if (!validCapabilities.has(cap)) {
      reasons.push(
        `Plugin declared unknown or unsupported capability '${cap}'.`,
      );
    }
  }

  // 5. Integrity metadata format check if provided
  if (manifest.integrity) {
    if (
      manifest.integrity.checksum &&
      !/^[a-fA-F0-9]{64}$/.test(manifest.integrity.checksum)
    ) {
      reasons.push(
        `Invalid SHA-256 integrity checksum format in plugin manifest: '${manifest.integrity.checksum}'.`,
      );
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons,
  };
}
