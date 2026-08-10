import { describe, expect, it } from "vitest";
import {
  maliciousSurfaces,
  validateMaliciousReport,
} from "./clean-room-malicious.mjs";

const valid = {
  schemaVersion: 1,
  gate: "clean-room:malicious-secret",
  commit: "a".repeat(40),
  rawSyntheticSecretOccurrences: 0,
  rootEscapes: 0,
  permissionEscapes: 0,
  results: maliciousSurfaces.map((id) => ({ id, status: "passed" })),
};
describe("malicious repository evidence", () => {
  it("requires zero raw secrets and zero root or permission escapes", () =>
    expect(validateMaliciousReport(valid)).toMatchObject({
      status: "passed",
      failures: 0,
      skips: 0,
    }));
  it("fails on missing surface or retained secret", () => {
    expect(() =>
      validateMaliciousReport({ ...valid, results: valid.results.slice(1) }),
    ).toThrow(/missing surfaces/);
    expect(() =>
      validateMaliciousReport({ ...valid, rawSyntheticSecretOccurrences: 1 }),
    ).toThrow(/secrets were retained/);
  });
});
