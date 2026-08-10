import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCli } from "../../../apps/cli/src/cli.js";
import { fuzitProfiles } from "../../../apps/mcp-server/src/tools/status.js";
import { renderPreview } from "../../../apps/vscode-extension/src/preview.js";
import { createTaskContext, runDoctor } from "@fuzit/core";
import { buildFilePackageGraph } from "@fuzit/graph";
import { PermissionBroker } from "@fuzit/plugin-host";
import { getProfile } from "@fuzit/profiles";
import type { NormalizedAnalysis } from "@fuzit/schemas";
import { withNetworkDenied } from "./harness.js";

describe("end-to-end zero-network proof (V1-119)", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "fuzit-zero-network-"));
    await writeFile(join(root, "index.ts"), "export const local = true;\n");
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it("observes CLI, daemon policy, MCP, extension, graph, context, and plugin boundaries", async () => {
    await withNetworkDenied(async () => {
      expect(
        await runCli(
          ["profile", "list"],
          { writeOut() {}, writeErr() {} },
          { repositoryRoot: root },
        ),
      ).toBe(0);

      const doctor = await runDoctor(root);
      expect(doctor.checks.find(({ id }) => id === "daemon")?.message).toBe(
        "No daemon is required for local CLI operation.",
      );
      expect(await fuzitProfiles({ allowedRoots: [root] })).toMatchObject({
        ok: true,
      });
      expect(renderPreview("local preview", { workspaceRoot: root })).toBe(
        "local preview",
      );

      const repositoryId = `sha256:${"a".repeat(64)}`;
      const analysis: NormalizedAnalysis = {
        schemaVersion: 1,
        repositoryId,
        analysisIdentity: "zero-network",
        files: [],
        modules: [],
        symbols: [],
        relationships: [],
        completeness: "complete",
        diagnostics: [],
      };
      expect(
        buildFilePackageGraph({ analysis, revision: "local", packages: [] })
          .nodes,
      ).toHaveLength(1);
      expect(
        createTaskContext({
          items: [],
          task: "local task",
          profile: getProfile("bug-fix"),
          budgetTokens: 100,
        }).selected,
      ).toEqual([]);
      expect(
        new PermissionBroker({ workspaceRoot: root }).authorize({
          kind: "network:connect",
          host: "example.com",
        }).allowed,
      ).toBe(false);
    });
  });

  it("runs the CLI packaging dry-run in a network-denied child process", async () => {
    const destination = await mkdtemp(join(tmpdir(), "fuzit-pack-network-"));
    try {
      const preload = pathToFileURL(
        resolve("tests/security/network/deny-network.mjs"),
      ).href;
      const result = spawnSync(
        process.execPath,
        [
          process.env.npm_execpath ?? "",
          "--dir",
          "apps/cli",
          "pack",
          "--pack-destination",
          destination,
        ],
        {
          cwd: resolve("."),
          encoding: "utf8",
          shell: false,
          env: {
            ...process.env,
            NODE_OPTIONS: `--import=${preload}`,
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  }, 30_000);
});
