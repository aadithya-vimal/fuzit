import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createIndexIdentitySet,
  createRepositoryId,
  openLocalIndex,
  writeLocalIndexSemanticState,
  type IndexSemanticVersions,
} from "@fuzit/index";
import { WatcherDaemon } from "@fuzit/watcher";

const TEST_REPO = resolve("tests/watcher/tmp-daemon-repo");
const TEST_CACHE = resolve("tests/watcher/tmp-daemon-cache");
const REPO_ID = createRepositoryId("daemon-repo");

function dummySemanticState(): IndexSemanticVersions {
  const hash = (char: string) => `sha256:${char.repeat(64)}`;
  return {
    contentHash: hash("0"),
    configHash: hash("1"),
    scannerVersion: "1",
    parserVersion: "1",
    securityPolicyVersion: "1",
    schemaVersion: 1,
    identities: createIndexIdentitySet({
      effectiveConfiguration: { format: "json" },
      ignorePolicy: { rules: [] },
      securityPolicy: { version: 1 },
      parser: { ts: "1" },
      analysis: { ext: "1" },
      graph: { schemaVersion: 1 },
      schema: { incrementalIndex: 1 },
    }),
  };
}

describe("daemon cancellation and shutdown", () => {
  it("starts daemon, holds lock, and cleanly stops releasing lock", async () => {
    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE, { recursive: true, force: true });
    await mkdir(join(TEST_REPO, "src"), { recursive: true });
    await writeFile(join(TEST_REPO, "src/index.ts"), "const x = 1;");

    const indexPath = join(TEST_CACHE, "index");
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummySemanticState());

    const daemon = new WatcherDaemon({
      repositoryRoot: TEST_REPO,
      indexPath,
      repositoryId: REPO_ID,
      semanticState: dummySemanticState(),
    });

    expect(daemon.status.state).toBe("stopped");

    await daemon.start();
    expect(daemon.status.state).toBe("watching");
    expect(daemon.status.lockOwner).not.toBeNull();

    await daemon.stop();
    expect(daemon.status.state).toBe("stopped");
    expect(daemon.status.lockOwner).toBeNull();

    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE, { recursive: true, force: true });
  });

  it("handles repeated shutdown safely without throwing", async () => {
    const daemon = new WatcherDaemon({
      repositoryRoot: TEST_REPO,
      indexPath: join(TEST_CACHE, "index"),
      repositoryId: REPO_ID,
      semanticState: dummySemanticState(),
    });

    await daemon.stop();
    await daemon.stop();
    expect(daemon.status.state).toBe("stopped");
  });
});
