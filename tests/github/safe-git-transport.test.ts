import { describe, it, expect } from "vitest";
import { buildSafeGitEnv } from "@fuzit/git";
import { resolveCredential } from "@fuzit/provider-github";

describe("GH-010: Safe Remote Git Transport", () => {
  it("builds safe Git environment preventing terminal prompt and interactive hooks", () => {
    const env = buildSafeGitEnv();
    expect(env["GIT_TERMINAL_PROMPT"]).toBe("0");
    expect(env["GIT_ASKPASS"]).toBe("echo");
    expect(env["SSH_ASKPASS"]).toBe("echo");
    expect(env["GIT_CONFIG_NOGLOBAL"]).toBe("1");
    expect(env["GIT_CONFIG_NOSYSTEM"]).toBe("1");
    expect(env["GIT_ALLOW_PROTOCOL"]).toBe("https");
    expect(env["GIT_LFS_SKIP_SMUDGE"]).toBe("1");
  });

  it("injects auth header into environment without putting token in args or remote URL", () => {
    const cred = resolveCredential({
      host: "github.com",
      env: { FUZIT_GITHUB_TOKEN: "secret_token_123" },
    });
    const env = buildSafeGitEnv(cred);
    expect(env["GIT_HTTP_HEADER"]).toBe("Authorization: Bearer secret_token_123");
  });
});
