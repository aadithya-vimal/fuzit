import { beforeEach, describe, expect, it, vi } from "vitest";

import { runPrReview } from "../src/application/review/pr-review-runner.js";

const spawnSync = vi.fn();

vi.mock("node:child_process", () => ({
  spawnSync,
}));

const prRef = {
  host: {
    webHost: "github.com",
    apiHost: "api.github.com",
  },
  owner: "alesaai",
  repo: "SnagNinja",
  number: 11,
} as const;

const privateMetadata = {
  title: "Private PR",
  state: "open",
  draft: false,
  user: { login: "aadithya-vimal" },
  base: { ref: "main" },
  head: { ref: "feature/private" },
};

const privateFiles = [
  {
    filename: "src/private.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: "@@ -0,0 +1 @@\n+export const secret = 1;\n",
  },
];

function installFetch(handler: (url: string, auth: string | null) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    return handler(url, headers.get("authorization"));
  });
  vi.stubGlobal("fetch", fetchMock as typeof fetch);
  return fetchMock;
}

beforeEach(() => {
  spawnSync.mockReset();
});

describe("runPrReview credential handoff", () => {
  it("injects the GitHub CLI credential into private PR requests", async () => {
    spawnSync.mockImplementation((command: string) => {
      if (command !== "gh") return { status: 1, stdout: "", stderr: "" };
      return { status: 0, stdout: "gh-cli-token\n", stderr: "" };
    });

    const fetchMock = installFetch((url, auth) => {
      if (url.endsWith("/files?per_page=100")) {
        expect(auth).toBe("Bearer gh-cli-token");
        return new Response(JSON.stringify(privateFiles), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      expect(auth).toBe("Bearer gh-cli-token");
      return new Response(JSON.stringify(privateMetadata), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await runPrReview({
      prRef,
      environment: {},
    });

    expect(result.ok).toBe(true);
    expect(result.targetRepo).toBe("alesaai/SnagNinja");
    expect(result.summary).toContain("Private PR");
    expect(result.summary).not.toContain("gh-cli-token");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("fails anonymous private PR access without leaking secrets", async () => {
    spawnSync.mockImplementation(() => ({ status: 1, stdout: "", stderr: "" }));

    installFetch((url, auth) => {
      expect(auth).toBeNull();
      return new Response("Not Found", { status: 404 });
    });

    await expect(runPrReview({ prRef, environment: {} })).rejects.toThrow(
      /private repository|not accessible/i,
    );
  });

  it("keeps public PR review functional without authentication", async () => {
    spawnSync.mockImplementation(() => ({ status: 1, stdout: "", stderr: "" }));

    installFetch((url, auth) => {
      expect(auth).toBeNull();
      if (url.endsWith("/files?per_page=100")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          title: "Public PR",
          state: "open",
          draft: false,
          user: { login: "octocat" },
          base: { ref: "main" },
          head: { ref: "feature/public" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await runPrReview({
      prRef: {
        ...prRef,
        owner: "microsoft",
        repo: "vscode-pull-request-github",
        number: 8769,
      },
      environment: {},
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toContain("Public PR");
  });
});
