import { describe, expect, it } from "vitest";
import {
  documentationAccuracyPlan,
  runDocumentationAccuracy,
} from "./docs-accuracy.mjs";

describe("frozen documentation accuracy", () => {
  it("keeps every documentation proof in deterministic order", () => {
    expect(documentationAccuracyPlan.map(([id]) => id)).toEqual([
      "local-build",
      "links-json-public-boundary",
      "public-contracts",
      "packed-commands",
      "limitations-risk-register",
      "license-claims",
      "public-source-boundary",
    ]);
  });

  it("records a partial result and fails when a proof fails", () => {
    const run = ([id]) => ({
      status: id === "packed-commands" ? 4 : 0,
      durationMs: 3,
    });
    const first = runDocumentationAccuracy({ run });
    expect(runDocumentationAccuracy({ run })).toEqual(first);
    expect(first.status).toBe("failed");
    expect(
      first.results.find(({ id }) => id === "packed-commands")?.exitCode,
    ).toBe(4);
  });

  it("passes only when every documentation proof passes", () => {
    expect(
      runDocumentationAccuracy({ run: () => ({ status: 0, durationMs: 1 }) }),
    ).toMatchObject({ status: "passed" });
  });
});
