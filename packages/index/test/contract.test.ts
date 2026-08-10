import { accessSync, constants, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRepositoryId,
  getLocalIndexPath,
  getLocalIndexStatus,
} from "../src/index.js";

describe("local index contract", () => {
  it("separates multiple repositories without exposing their paths", () => {
    const cacheHome = join(tmpdir(), "fuzit-contract");
    const first = getLocalIndexPath({
      cacheHome,
      repositoryFingerprint: "git:origin.example/alpha",
    });
    const second = getLocalIndexPath({
      cacheHome,
      repositoryFingerprint: "git:origin.example/beta",
    });

    expect(first).not.toBe(second);
    expect(first).not.toContain("alpha");
    expect(second).not.toContain("beta");
  });

  it("keeps identity stable when a repository moves", () => {
    const fingerprint = "git:origin.example/project";
    expect(createRepositoryId(fingerprint)).toBe(
      createRepositoryId(fingerprint),
    );
  });

  it("requires rebuild on schema mismatch", () => {
    const status = getLocalIndexStatus(
      {
        cacheHome: join(tmpdir(), "fuzit-contract"),
        repositoryFingerprint: "git:origin.example/project",
      },
      { kind: "ready", schemaVersion: 2 },
    );

    expect(status).toMatchObject({
      schemaVersion: 1,
      state: "schema-mismatch",
      rebuildRequired: true,
    });
  });

  it("does not write while resolving a path in a read-only home", () => {
    const readOnlyHome = mkdtempSync(join(tmpdir(), "fuzit-read-only-"));
    accessSync(readOnlyHome, constants.R_OK);

    const path = getLocalIndexPath({
      cacheHome: readOnlyHome,
      repositoryFingerprint: "git:origin.example/project",
    });

    expect(path).toContain(readOnlyHome);
    expect(() => accessSync(path)).toThrow();
  });

  it("reports privacy-safe repository identifiers", () => {
    const secretPath = "C:\\Users\\private-user\\secret-project";
    const status = getLocalIndexStatus({
      cacheHome: join(tmpdir(), "fuzit-contract"),
      repositoryFingerprint: `git:${secretPath}`,
    });

    expect(status.repositoryId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(status.path).not.toContain("private-user");
    expect(JSON.stringify(status)).not.toContain(secretPath);
  });
});
