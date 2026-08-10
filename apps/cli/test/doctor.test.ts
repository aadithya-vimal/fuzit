import { describe, expect, it } from "vitest";

import { formatDoctorReport } from "../src/commands/doctor/register.js";

describe("doctor human output", () => {
  it("does not leak private paths", () => {
    const privatePath = "C:\\Users\\private-user\\secret-repository";
    const output = formatDoctorReport({
      schemaVersion: 1,
      status: "attention",
      checks: [
        {
          id: "repository",
          status: "fail",
          message: "Repository not detected.",
          metadata: { detected: false },
        },
      ],
    });

    expect(output).toContain("FAIL repository: Repository not detected.");
    expect(output).not.toContain(privatePath);
    expect(output).not.toContain("C:\\Users");
  });
});
