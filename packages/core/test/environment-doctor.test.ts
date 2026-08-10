import { constants } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DOCTOR_REPORT_JSON_SCHEMA,
  runDoctor,
  type DoctorDependencies,
} from "../src/index.js";

const passingDependencies: DoctorDependencies = {
  nodeVersion: "24.0.0",
  pnpmUserAgent: "pnpm/11.9.0 npm/? node/v24.0.0",
  checkGit: () => "2.50.0",
  checkPnpm: () => "11.9.0",
  platform: "linux",
  checkAccess: async () => {},
  checkPath: async (path) => path.endsWith(".git"),
  checkConfiguration: async () => {},
};

describe("environment doctor", () => {
  it("reports Git missing", async () => {
    const report = await runDoctor("repository", {
      ...passingDependencies,
      checkGit: () => undefined,
    });

    expect(report.status).toBe("attention");
    expect(report.checks.find(({ id }) => id === "git")).toMatchObject({
      status: "fail",
      message: "Git is unavailable.",
    });
  });

  it("reports when not in a repository", async () => {
    const report = await runDoctor("directory", {
      ...passingDependencies,
      checkPath: async () => false,
    });

    expect(report.checks.find(({ id }) => id === "repository")).toMatchObject({
      status: "fail",
      metadata: { detected: false },
    });
  });

  it("reports a read-only directory", async () => {
    const report = await runDoctor("repository", {
      ...passingDependencies,
      checkAccess: async (_path, mode) => {
        if (mode === constants.W_OK) {
          const error = new Error("read only");
          Object.assign(error, { code: "EACCES" });
          throw error;
        }
      },
    });

    expect(report.checks.find(({ id }) => id === "filesystem")).toMatchObject({
      status: "fail",
      metadata: { readable: true, writable: false },
    });
  });

  it("publishes a stable JSON schema and matching report shape", async () => {
    const report = await runDoctor("repository", passingDependencies);

    expect(DOCTOR_REPORT_JSON_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "status", "checks"],
    });
    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      checks: expect.arrayContaining([
        expect.objectContaining({ id: "node" }),
        expect.objectContaining({ id: "pnpm" }),
        expect.objectContaining({ id: "git" }),
        expect.objectContaining({ id: "filesystem" }),
        expect.objectContaining({ id: "repository" }),
        expect.objectContaining({ id: "configuration" }),
      ]),
    });
    expect(report.checks).toHaveLength(12);
  });

  it("reports installed pnpm without relying on user-agent metadata", async () => {
    const report = await runDoctor("repository", {
      ...passingDependencies,
      pnpmUserAgent: "npm/11 node/v24",
      checkPnpm: () => "11.9.0",
    });
    expect(report.checks.find(({ id }) => id === "pnpm")).toMatchObject({
      status: "pass",
      metadata: { version: "11.9.0" },
    });
  });

  it("returns actionable warnings for missing tools and optional surfaces", async () => {
    const report = await runDoctor("repository", {
      ...passingDependencies,
      pnpmUserAgent: "npm/11 node/v24",
      checkPnpm: () => undefined,
      checkPath: async (path) => path.endsWith(".git"),
    });
    expect(report.checks.find(({ id }) => id === "pnpm")?.message).toContain(
      "unavailable",
    );
    expect(report.checks.find(({ id }) => id === "mcp")?.status).toBe(
      "warning",
    );
    expect(report.checks.find(({ id }) => id === "extension")?.status).toBe(
      "warning",
    );
  });
});
