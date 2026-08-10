import { describe, expect, it } from "vitest";
import {
  parsePluginManifest,
  serializePluginManifest,
  validatePluginManifest,
  type PluginManifest,
} from "@fuzit/plugin-sdk";

describe("Plugin Manifest Schema (V1-100)", () => {
  const validBaseManifest: PluginManifest = {
    schemaVersion: 1,
    id: "com.example.test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    protocol: "fuzit-plugin-v1",
    fuzitVersion: "^1.0.0",
    entryPoint: "dist/index.js",
    capabilities: ["parser", "collector"],
    permissions: {
      filesystem: {
        readPaths: ["src/"],
      },
      shell: false,
      persistence: false,
    },
    integrity: {
      checksum: "sha256:abcd1234efgh5678",
      signature: "placeholder-sig",
      algorithm: "sha256",
    },
  };

  it("parses valid plugin manifest cleanly", () => {
    const parsed = parsePluginManifest(validBaseManifest);
    expect(parsed.id).toBe("com.example.test-plugin");
    expect(parsed.capabilities).toEqual(["parser", "collector"]);
    expect(parsed.permissions?.filesystem?.readPaths).toEqual(["src/"]);
  });

  it("round-trips signed-metadata placeholders without claiming signature verification", () => {
    const serialized = serializePluginManifest(validBaseManifest);
    expect(serialized).toContain("sha256:abcd1234efgh5678");
    expect(serialized).toContain("placeholder-sig");

    const reParsed = parsePluginManifest(JSON.parse(serialized));
    expect(reParsed.integrity).toEqual({
      checksum: "sha256:abcd1234efgh5678",
      signature: "placeholder-sig",
      algorithm: "sha256",
    });
  });

  it("rejects invalid plugin IDs with path traversal or illegal characters", () => {
    const invalidIds = [
      "../invalid-id",
      "invalid/id",
      "invalid\\id",
      "ID_WITH_UPPERCASE",
      "id with space",
      ".leading-dot",
    ];

    for (const id of invalidIds) {
      const result = validatePluginManifest({
        ...validBaseManifest,
        id,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects entryPoint path traversal and absolute paths", () => {
    const invalidEntryPoints = [
      "../escape.js",
      "../../etc/passwd",
      "/usr/local/bin/plugin.js",
      "\\windows\\system32\\plugin.dll",
      "C:\\plugin.js",
    ];

    for (const entryPoint of invalidEntryPoints) {
      const result = validatePluginManifest({
        ...validBaseManifest,
        entryPoint,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects filesystem permission read/write paths with path traversal", () => {
    const invalidReadResult = validatePluginManifest({
      ...validBaseManifest,
      permissions: {
        filesystem: {
          readPaths: ["../outside-workspace"],
        },
      },
    });
    expect(invalidReadResult.success).toBe(false);

    const invalidWriteResult = validatePluginManifest({
      ...validBaseManifest,
      permissions: {
        filesystem: {
          writePaths: ["/absolute/path"],
        },
      },
    });
    expect(invalidWriteResult.success).toBe(false);
  });

  it("rejects invalid semver versions and fuzitVersion ranges", () => {
    const invalidVersionResult = validatePluginManifest({
      ...validBaseManifest,
      version: "not-a-semver",
    });
    expect(invalidVersionResult.success).toBe(false);

    const invalidFuzitVersionResult = validatePluginManifest({
      ...validBaseManifest,
      fuzitVersion: "invalid-range!!!",
    });
    expect(invalidFuzitVersionResult.success).toBe(false);
  });

  it("rejects undeclared or invalid capabilities", () => {
    const invalidCapabilityResult = validatePluginManifest({
      ...validBaseManifest,
      capabilities: ["arbitrary-code-execution" as unknown as PluginCapability],
    });
    expect(invalidCapabilityResult.success).toBe(false);

    const emptyCapabilitiesResult = validatePluginManifest({
      ...validBaseManifest,
      capabilities: [],
    });
    expect(emptyCapabilitiesResult.success).toBe(false);
  });
});
