import { spawnSync } from "node:child_process";
import {
  githubRequest,
  resolveBestGitHubCredential,
} from "@fuzit/provider-github";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

interface AuthCommandDependencies {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly setExitCode: (code: ExitCode) => void;
}

function ghAvailable(): boolean {
  return (
    spawnSync("gh", ["--version"], { encoding: "utf8", shell: false })
      .status === 0
  );
}

function ghLogin(host: string): { ok: boolean; message?: string } {
  const result = spawnSync(
    "gh",
    ["auth", "login", "--hostname", host, "--web"],
    { encoding: "utf8", shell: false, stdio: "pipe" },
  );
  if (result.status !== 0) {
    return {
      ok: false,
      message:
        result.stderr.trim() ||
        result.stdout.trim() ||
        "GitHub CLI login failed.",
    };
  }
  return { ok: true };
}

async function authStatus(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const credential = await resolveBestGitHubCredential({
    host: "github.com",
    env: environment,
  });
  if (!credential.isAuthenticated) {
    return {
      kind: "auth",
      status: "Not authenticated",
      host: "github.com",
      source: "anonymous",
      nextStep:
        "Run `fuzit auth github` or set `GH_TOKEN` / `FUZIT_GITHUB_TOKEN`.",
    };
  }
  const response = await githubRequest("https://api.github.com/user", {
    credential,
    allowedHosts: ["github.com", "api.github.com"],
  });
  if (!response.ok) {
    return {
      kind: "auth",
      status: "Authenticated",
      host: "github.com",
      source: credential.source,
      error:
        response.kind === "rate-limited"
          ? "GitHub rate limited the account lookup."
          : "GitHub credential could not be verified.",
      nextStep: "Re-run `fuzit auth github` or refresh the credential.",
    };
  }
  if (response.status !== 200) {
    return {
      kind: "auth",
      status: "Authenticated",
      host: "github.com",
      source: credential.source,
      error:
        "GitHub credential could not be verified.",
      nextStep: "Re-run `fuzit auth github` or refresh the credential.",
    };
  }
  let login = "unknown";
  try {
    const data = JSON.parse(response.body) as { login?: string };
    if (typeof data.login === "string") login = data.login;
  } catch {
    // ignore; human output still succeeds
  }
  return {
    kind: "auth",
    status: "Authenticated",
    host: "github.com",
    account: login,
    source: credential.source,
    permission: "Pull requests: read",
    nextStep: "Ready for private pull-request review.",
  };
}

function renderAuthStatus(
  status: Awaited<ReturnType<typeof authStatus>>,
): string {
  const lines = [
    "GitHub Authentication",
    "",
    `Status: ${status.status}`,
    `Host: ${status.host}`,
  ];
  if ("account" in status) {
    lines.push(`Account: ${status.account}`);
  }
  if ("source" in status) {
    lines.push(`Source: ${status.source}`);
  }
  if ("permission" in status) {
    lines.push(`Permission: ${status.permission}`);
  }
  if ("error" in status) {
    lines.push(`Error: ${status.error}`);
  }
  if ("nextStep" in status) {
    lines.push(`Next: ${status.nextStep}`);
  }
  return `${lines.join("\n")}\n`;
}

export function registerAuthCommand(
  program: Command,
  dependencies: AuthCommandDependencies,
): void {
  const auth = program
    .command("auth")
    .description("manage GitHub authentication");

  auth
    .command("github")
    .description("authenticate the GitHub CLI session for Fuzit")
    .action(async () => {
      if (!ghAvailable()) {
        dependencies.writeData({
          kind: "auth",
          error: "GitHub CLI (`gh`) is not installed.",
          nextStep: "Install `gh` or set `GH_TOKEN` / `FUZIT_GITHUB_TOKEN`.",
        });
        dependencies.setExitCode(EXIT_CODES.environment);
        return;
      }
      const existing = await authStatus(dependencies.environment);
      if (existing.status === "Authenticated") {
        dependencies.writeData({
          ...existing,
          status: "Already authenticated",
          nextStep: "✓ Ready for private pull-request review.",
        });
        dependencies.setExitCode(EXIT_CODES.success);
        return;
      }
      const login = ghLogin("github.com");
      if (!login.ok) {
        dependencies.writeData({
          kind: "auth",
          error: login.message ?? "GitHub CLI login failed.",
          nextStep: "Use `gh auth login --hostname github.com --web` directly.",
        });
        dependencies.setExitCode(EXIT_CODES.environment);
        return;
      }
      dependencies.writeData(
        renderAuthStatus(await authStatus(dependencies.environment)),
      );
      dependencies.setExitCode(EXIT_CODES.success);
    });

  auth
    .command("status")
    .description("show GitHub authentication status")
    .action(async () => {
      dependencies.writeData(
        renderAuthStatus(await authStatus(dependencies.environment)),
      );
      dependencies.setExitCode(EXIT_CODES.success);
    });
}
