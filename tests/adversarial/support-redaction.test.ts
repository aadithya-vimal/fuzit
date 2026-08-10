import { describe, expect, it } from "vitest";
import {
  createSupportBundlePreview,
  redactErrorData,
  redactSensitiveText,
} from "@fuzit/security";

describe("central output and support redaction (V1-115)", () => {
  const secret = "SyntheticSecretValue123456";

  it("redacts stdout, stderr, and nested circular error objects deterministically", () => {
    const nested: Record<string, unknown> = {
      stdout: `token=${secret}`,
      stderr: `https://user:${secret}@example.test/repo`,
      nested: { password: secret },
    };
    nested.circular = nested;
    Object.defineProperty(nested, "__proto__", {
      enumerable: true,
      value: secret,
    });
    const first = redactErrorData(nested);
    const second = redactErrorData(nested);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toContain(secret);
    expect(JSON.stringify(first)).toContain("[CIRCULAR]");
    expect(Object.prototype.hasOwnProperty.call(first, "__proto__")).toBe(
      false,
    );
  });

  it("creates a bounded metadata-only local support preview", () => {
    const bundle = createSupportBundlePreview({
      productVersion: "1.0.0",
      checks: [
        {
          surface: "plugin",
          status: "fail",
          error: new Error(`secret=${secret}`),
        },
        { surface: "git", status: "warning", error: `token=${secret}` },
      ],
    });
    expect(bundle.checks.map(({ surface }) => surface)).toEqual([
      "git",
      "plugin",
    ]);
    expect(bundle.contentIncluded).toBe(false);
    expect(JSON.stringify(bundle)).not.toContain(secret);
    expect(redactSensitiveText(`token=${secret}`)).not.toContain(secret);
  });
});
