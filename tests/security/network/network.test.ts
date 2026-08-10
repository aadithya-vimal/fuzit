import dns from "node:dns";
import http from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../../../apps/cli/src/cli.js";
import { withNetworkDenied } from "./harness.js";

describe("deny-by-default network gate", () => {
  it("detects DNS attempts", async () => {
    await expect(
      withNetworkDenied(
        async () =>
          new Promise((resolve) =>
            dns.lookup("example.invalid", () => resolve(undefined)),
          ),
      ),
    ).rejects.toThrow("DNS");
  });
  it("detects HTTP/socket attempts", async () => {
    await expect(
      withNetworkDenied(
        async () =>
          new Promise((resolve) => {
            http.get("http://127.0.0.1/", resolve);
          }),
      ),
    ).rejects.toThrow("network socket");
  });
  it("runs context and JSON/debug/crash paths without network", async () => {
    const root = await mkdtemp(join(tmpdir(), "fuzit-network-"));
    await writeFile(join(root, "auth.ts"), "authentication\n");
    await withNetworkDenied(async () => {
      expect(
        await runCli(
          [
            "context",
            "--root",
            root,
            "--task",
            "authentication",
            "--profile",
            "bug-fix",
            "--budget-tokens",
            "100",
            "--format",
            "json",
            "--output",
            "-",
            "--no-index",
          ],
          { writeOut() {}, writeErr() {} },
          { repositoryRoot: root },
        ),
      ).toBe(0);
      for (const arguments_ of [
        ["--json", "profile", "list"],
        ["--debug", "unknown"],
      ] as const) {
        await runCli(
          arguments_,
          { writeOut() {}, writeErr() {} },
          { repositoryRoot: root },
        );
      }
    });
  });
});
