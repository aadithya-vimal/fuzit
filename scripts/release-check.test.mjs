import { describe, expect, it } from "vitest";
import {
  findUnexpectedDirty,
  validateReleasePolicy,
} from "./release-check.mjs";

const valid = {
  changesets: ["alpha.md"],
  versions: ["0.0.0", "0.0.0"],
  changelog: "0.0.0",
  schemaPolicy: "migration and rebuild",
  unexpectedDirty: [],
};

describe("release policy", () => {
  it("rejects a missing changeset", () =>
    expect(validateReleasePolicy({ ...valid, changesets: [] })).toContain(
      "missing changeset",
    ));
  it("rejects a schema bump without migration or rebuild notes", () =>
    expect(
      validateReleasePolicy({ ...valid, schemaPolicy: "schema changed" }),
    ).toContain("schema bump lacks migration/rebuild note"));
  it("rejects version mismatch", () =>
    expect(
      validateReleasePolicy({ ...valid, versions: ["0.0.0", "0.1.0"] }),
    ).toContain("version mismatch"));
  it("rejects unexpected dirty paths", () =>
    expect(
      validateReleasePolicy({ ...valid, unexpectedDirty: ["secret.txt"] })[0],
    ).toContain("dirty tree"));
  it("accepts current checkpoint and explicitly preserved custody", () =>
    expect(
      findUnexpectedDirty(
        ["changed.txt", "owner.txt", "surprise.txt"],
        ["changed.txt"],
        ["owner.txt"],
      ),
    ).toEqual(["surprise.txt"]));
});
