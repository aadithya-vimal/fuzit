import { describe, expect, it } from "vitest";
import {
  createWindowsCleanRoomReport,
  windowsCleanRoomScenarios,
} from "./clean-room-windows.mjs";

const scenarios = windowsCleanRoomScenarios.map(({ id, command }) => ({
  id,
  command: command.join(" "),
  status: "passed",
  exitCode: 0,
}));
const input = {
  platform: "win32",
  architecture: "x64",
  node: "v24.0.0",
  commit: "a".repeat(40),
  scenarios,
  artifactHashes: ["b".repeat(64)],
};

describe("Windows clean-room report", () => {
  it("records every mandatory scenario without failures or skips", () =>
    expect(createWindowsCleanRoomReport(input)).toMatchObject({
      status: "passed",
      mandatoryFailures: 0,
      mandatorySkips: 0,
    }));
  it("rejects a failed or skipped mandatory scenario", () =>
    expect(() =>
      createWindowsCleanRoomReport({ ...input, scenarios: scenarios.slice(1) }),
    ).toThrow(/mandatory scenario/));
  it("rejects non-Windows and missing artifact identity", () => {
    expect(() =>
      createWindowsCleanRoomReport({ ...input, platform: "linux" }),
    ).toThrow(/requires win32/);
    expect(() =>
      createWindowsCleanRoomReport({ ...input, artifactHashes: [] }),
    ).toThrow(/artifact hashes/);
  });
});
