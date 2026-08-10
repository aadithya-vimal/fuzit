import { describe, it, expect } from "vitest";
import { routeSourceInput } from "@fuzit/core";

describe("GH-025: Accept Remote Sources in Core CLI Workflows", () => {
  it("routes repo URL to context, PR URL to review, issue URL to issue, and path to local", () => {
    expect(routeSourceInput("https://github.com/owner/repo").target).toBe("context");
    expect(routeSourceInput("https://github.com/owner/repo/pull/1").target).toBe("review");
    expect(routeSourceInput("https://github.com/owner/repo/issues/2").target).toBe("issue");
    expect(routeSourceInput("./my-local-dir").target).toBe("local");
  });
});
