import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

if (process.platform !== "win32") {
  throw new Error(
    `Windows native verification requires win32; received ${process.platform}.`,
  );
}

const root = resolve(".");
const temporary = resolve(root, ".cache", "windows-native");
await mkdir(temporary, { recursive: true });

const commands = [
  ["install", "--frozen-lockfile"],
  ["build"],
  ["test"],
  ["test:security"],
  ["test:watcher"],
  ["test:cross-platform"],
  ["package:smoke"],
  ["acceptance:alpha"],
];

try {
  for (const arguments_ of commands) {
    const result = spawnSync(
      process.execPath,
      [process.env.npm_execpath, ...arguments_],
      {
        cwd: root,
        encoding: "utf8",
        shell: false,
        stdio: "inherit",
        env: {
          ...process.env,
          ...(arguments_[0] === "package:smoke"
            ? { FUZIT_PACKAGE_TEMP_PARENT: temporary }
            : {}),
        },
      },
    );
    if (result.status !== 0)
      throw new Error(`pnpm ${arguments_.join(" ")} exited ${result.status}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
