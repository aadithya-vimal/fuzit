import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createIndexIdentitySet,
  createRepositoryId,
  openLocalIndex,
  readCommittedIndexState,
  writeLocalIndexSemanticState,
  type IndexSemanticVersions,
} from "@fuzit/index";
import {
  EventCoalescer,
  NativeFilesystemAdapter,
  reconcileRepositoryState,
} from "@fuzit/watcher";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function semanticState(): IndexSemanticVersions {
  const hash = (character: string) => `sha256:${character.repeat(64)}`;
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

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "fuzit-watcher-native-"));
  const repositoryRoot = join(root, "repository");
  const indexPath = join(root, "index");
  roots.push(root);
  await mkdir(join(repositoryRoot, "src"), { recursive: true });
  const repositoryId = createRepositoryId("watcher-native-fixture");
  await openLocalIndex(indexPath, repositoryId);
  await writeLocalIndexSemanticState(indexPath, semanticState());
  return { repositoryRoot, indexPath, repositoryId };
}

describe("native watcher semantic equivalence", () => {
  it("reconciles all event shapes and overflow to clean-scan state", async () => {
    const { repositoryRoot, indexPath, repositoryId } = await fixture();
    await writeFile(join(repositoryRoot, "src/change.ts"), "before");
    await writeFile(join(repositoryRoot, "src/delete.ts"), "delete");
    await writeFile(join(repositoryRoot, "src/rename-from.ts"), "rename");
    await reconcileRepositoryState(new EventCoalescer().flush("initial"), {
      indexPath,
      repositoryId,
      repositoryRoot,
      semanticState: semanticState(),
    });

    const observed = [];
    const adapter = new NativeFilesystemAdapter({
      repositoryRoot,
      onEvent: (event) => observed.push(event),
    });
    await adapter.start();
    await writeFile(join(repositoryRoot, "src/add.ts"), "added");
    adapter.emitSyntheticEvent("add", "src/add.ts");
    await writeFile(join(repositoryRoot, "src/change.ts"), "after-change");
    adapter.emitSyntheticEvent("modify", "src/change.ts");
    await rm(join(repositoryRoot, "src/delete.ts"));
    adapter.emitSyntheticEvent("delete", "src/delete.ts");
    await rename(
      join(repositoryRoot, "src/rename-from.ts"),
      join(repositoryRoot, "src/rename-to.ts"),
    );
    adapter.emitSyntheticEvent(
      "rename",
      "src/rename-from.ts",
      "src/rename-to.ts",
    );
    await writeFile(join(repositoryRoot, "src/atomic.ts.tmp"), "atomic");
    await rename(
      join(repositoryRoot, "src/atomic.ts.tmp"),
      join(repositoryRoot, "src/atomic.ts"),
    );
    adapter.emitSyntheticEvent("rename", "src/atomic.ts.tmp", "src/atomic.ts");
    await adapter.stop();

    const coalescer = new EventCoalescer({ maxBatchSize: 2 });
    coalescer.pushAll(observed);
    const batch = coalescer.flush("native-overflow");
    expect(batch).toMatchObject({
      overflowOccurred: true,
      reconciliationRequired: true,
    });
    await reconcileRepositoryState(batch, {
      indexPath,
      repositoryId,
      repositoryRoot,
      semanticState: semanticState(),
    });
    const state = await readCommittedIndexState(indexPath);
    expect(state?.records.map(({ path }) => path).sort()).toEqual([
      "src/add.ts",
      "src/atomic.ts",
      "src/change.ts",
      "src/rename-to.ts",
    ]);
    expect(await readFile(join(repositoryRoot, "src/change.ts"), "utf8")).toBe(
      "after-change",
    );
  });

  it("aborts reconciliation without committing partial state", async () => {
    const { repositoryRoot, indexPath, repositoryId } = await fixture();
    await writeFile(join(repositoryRoot, "src/kept.ts"), "kept");
    const controller = new AbortController();
    controller.abort();
    await expect(
      reconcileRepositoryState(new EventCoalescer().flush("aborted"), {
        indexPath,
        repositoryId,
        repositoryRoot,
        semanticState: semanticState(),
        signal: controller.signal,
      }),
    ).rejects.toThrow("aborted prior to execution");
    expect(await readCommittedIndexState(indexPath)).toBeUndefined();
  });
});
