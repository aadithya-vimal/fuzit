import { describe, expect, it } from "vitest";
import {
  satisfiesSemver,
  validatePluginCompatibility,
} from "@fuzit/plugin-host";
import { parsePluginManifest } from "@fuzit/plugin-sdk";

describe("Compatibility Negotiation (V1-104)", () => {
  const baseManifestData = {
    schemaVersion: 1,
    id: "com.example.compat-test",
    name: "Compat Test Plugin",
    version: "1.0.0",
    protocol: "fuzit-plugin-v1",
    fuzitVersion: "^1.0.0",
    entryPoint: "dist/plugin.js",
    capabilities: ["parser"],
  };

  it("validates semver range matching correctly across current, old, future, and range formats", () => {
    expect(satisfiesSemver("1.0.0", "^1.0.0")).toBe(true);
    expect(satisfiesSemver("1.5.2", "^1.0.0")).toBe(true);
    expect(satisfiesSemver("2.0.0", "^1.0.0")).toBe(false);

    expect(satisfiesSemver("1.2.0", "~1.2.0")).toBe(true);
    expect(satisfiesSemver("1.2.5", "~1.2.0")).toBe(true);
    expect(satisfiesSemver("1.3.0", "~1.2.0")).toBe(false);

    expect(satisfiesSemver("1.10.0", ">=1.0.0")).toBe(true);
    expect(satisfiesSemver("0.9.0", ">=1.0.0")).toBe(false);
  });

  it("accepts fully compatible manifest with current host", () => {
    const manifest = parsePluginManifest(baseManifestData);
    const result = validatePluginCompatibility(manifest, {
      hostVersion: "1.2.0",
    });
    expect(result.compatible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("rejects manifest with incompatible protocol version", () => {
    const manifest = parsePluginManifest({
      ...baseManifestData,
      protocol: "fuzit-plugin-v99",
    });
    const result = validatePluginCompatibility(manifest);
    expect(result.compatible).toBe(false);
    expect(result.reasons).toEqual([
      "Incompatible plugin protocol 'fuzit-plugin-v99'. Host supports protocol 'fuzit-plugin-v1'.",
    ]);
  });

  it("rejects manifest requiring a future incompatible Fuzit version", () => {
    const manifest = parsePluginManifest({
      ...baseManifestData,
      fuzitVersion: "^2.0.0",
    });
    const result = validatePluginCompatibility(manifest, {
      hostVersion: "1.5.0",
    });
    expect(result.compatible).toBe(false);
    expect(result.reasons).toEqual([
      "Plugin 'com.example.compat-test' requires Fuzit version '^2.0.0', but current host is '1.5.0'.",
    ]);
  });

  it("rejects manifest requiring an old host version incompatible with requirement", () => {
    const manifest = parsePluginManifest({
      ...baseManifestData,
      fuzitVersion: ">=2.0.0",
    });
    const result = validatePluginCompatibility(manifest, {
      hostVersion: "1.0.0",
    });
    expect(result.compatible).toBe(false);
    expect(result.reasons).toEqual([
      "Plugin 'com.example.compat-test' requires Fuzit version '>=2.0.0', but current host is '1.0.0'.",
    ]);
  });

  it("validates optional SHA-256 integrity metadata format", () => {
    const validIntegrity = parsePluginManifest({
      ...baseManifestData,
      integrity: {
        checksum: "a".repeat(64),
      },
    });
    expect(validatePluginCompatibility(validIntegrity).compatible).toBe(true);

    const invalidIntegrity = parsePluginManifest({
      ...baseManifestData,
      integrity: {
        checksum: "short-invalid-hash",
      },
    });
    const result = validatePluginCompatibility(invalidIntegrity);
    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain(
      "Invalid SHA-256 integrity checksum format",
    );
  });
});
