import { describe, expect, it } from "vitest";
import {
  AUTHORIZED,
  BLOCKED,
  BLOCKED_AUTHORIZED,
  READY,
  determineFinalVerdict,
} from "./final-verdict.mjs";

describe("final V1 verdict", () => {
  it("blocks deterministically when a blocker or decision remains", () => {
    const input = {
      blockers: ["native"],
      decisions: [{ id: "publish", approved: false }],
      publicationAuthorized: false,
    };
    expect(determineFinalVerdict(input)).toEqual(determineFinalVerdict(input));
    expect(determineFinalVerdict(input)).toMatchObject({
      verdict: BLOCKED,
      publicationActionsPermitted: false,
    });
  });
  it("uses the preferred readiness verdict only when all prerequisites are satisfied", () => {
    expect(
      determineFinalVerdict({
        blockers: [],
        decisions: [{ id: "license", approved: true }],
        publicationAuthorized: false,
      }),
    ).toMatchObject({ verdict: READY, publicationAuthorized: false });
  });
  it("never permits publication from a technical verdict", () => {
    expect(
      determineFinalVerdict({
        blockers: [],
        decisions: [],
        publicationAuthorized: false,
      }).publicationActionsPermitted,
    ).toBe(false);
  });
  it("permits publication only after explicit authorization", () => {
    expect(
      determineFinalVerdict({
        blockers: [],
        decisions: [],
        publicationAuthorized: true,
      }),
    ).toMatchObject({ verdict: AUTHORIZED, publicationActionsPermitted: true });
  });
  it("keeps an authorized release blocked while a technical blocker is open", () => {
    expect(
      determineFinalVerdict({
        blockers: ["dependency-closure"],
        decisions: [],
        publicationAuthorized: true,
      }),
    ).toMatchObject({
      verdict: BLOCKED_AUTHORIZED,
      publicationActionsPermitted: false,
    });
  });
});
