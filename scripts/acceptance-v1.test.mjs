import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  acceptanceScenarios,
  runAcceptance,
  selectAcceptanceScenarios,
} from "./acceptance-v1.mjs";

describe("unified V1 acceptance", () => {
  it("keeps a deterministic mandatory scenario order", () => {
    expect(selectAcceptanceScenarios()).toEqual(acceptanceScenarios);
    expect(
      new Set(acceptanceScenarios.map(({ category }) => category)),
    ).toEqual(
      new Set([
        "product",
        "platform",
        "security",
        "incremental",
        "graph",
        "mcp",
        "plugin",
        "extension",
        "packaging",
        "docs",
        "cleanliness",
      ]),
    );
  });

  it("records every result and fails when any mandatory scenario fails", () => {
    const invoked = [];
    const summary = runAcceptance({
      filters: ["graph", "mcp"],
      execute: ({ id }) => {
        invoked.push(id);
        return {
          status: id === "graph-tests" ? 7 : 0,
          durationMs: id === "graph-tests" ? 12 : 4,
          warnings: id === "graph-tests" ? ["synthetic warning"] : [],
          artifacts: id === "mcp-tests" ? ["synthetic artifact"] : [],
        };
      },
    });
    expect(invoked).toEqual(["graph-tests", "mcp-tests"]);
    expect(summary.status).toBe("failed");
    expect(summary.results.map(({ exitCode }) => exitCode)).toEqual([7, 0]);
    expect(summary.scenarioCount).toBe(2);
    expect(summary.warningCount).toBe(1);
    expect(summary.results.map(({ durationMs }) => durationMs)).toEqual([
      12, 4,
    ]);
    expect(summary.results[1].artifacts).toEqual(["synthetic artifact"]);
  });

  it("exposes stable structured scenario discovery through the CLI", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/acceptance-v1.mjs", "--list", "--filter", "platform"],
      { encoding: "utf8" },
    );
    expect(JSON.parse(output)).toEqual({
      schemaVersion: 1,
      gate: "acceptance:v1",
      scenarios: [
        {
          id: "platform-contracts",
          category: "platform",
          command: ["pnpm", "test:cross-platform"],
        },
      ],
    });
  });
});
