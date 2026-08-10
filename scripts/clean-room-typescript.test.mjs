import { describe, expect, it } from "vitest";
import {
  createTypeScriptValidationReport,
  expectedTypeScriptFindings,
} from "./clean-room-typescript.mjs";

const valid = {
  commit: "a".repeat(40),
  packageResult: {
    localInstall: "ok",
    packageContents: "audited",
    tarballs: 3,
    commands: [...expectedTypeScriptFindings],
  },
};

describe("TypeScript application clean-room evidence", () => {
  it("records stable expected-versus-observed findings", () =>
    expect(createTypeScriptValidationReport(valid)).toMatchObject({
      status: "passed",
      failures: 0,
      skips: 0,
      publicationActions: [],
    }));
  it("fails on a missing workflow finding", () =>
    expect(() =>
      createTypeScriptValidationReport({
        ...valid,
        packageResult: {
          ...valid.packageResult,
          commands: valid.packageResult.commands.slice(1),
        },
      }),
    ).toThrow(/missing observed findings/));
  it("fails on a partial public install", () =>
    expect(() =>
      createTypeScriptValidationReport({
        ...valid,
        packageResult: { ...valid.packageResult, localInstall: "failed" },
      }),
    ).toThrow(/install did not pass/));
});
