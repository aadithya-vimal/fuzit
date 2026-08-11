import { open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { EXIT_CODES, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";

interface ApplyDependencies {
  readonly currentDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly setExitCode: (code: ExitCode) => void;
}

export function parseAiCodeBlocks(input: string): Array<{ path: string; content: string }> {
  const blocks: Array<{ path: string; content: string }> = [];
  
  // Match patterns like ```typescript:src/app.ts or ```js path=src/app.js or ## src/app.ts\n```...```
  const fileHeaderRegex = /^(?:#{2,3}\s+|File:\s*|Path:\s*)([a-zA-Z0-9_.\-\/\\]+\.[a-zA-Z0-9]+)\s*\n```[a-zA-Z]*\n([\s\S]*?)```/gm;
  let match: RegExpExecArray | null;
  while ((match = fileHeaderRegex.exec(input)) !== null) {
    if (match[1] && match[2]) {
      blocks.push({ path: match[1].trim(), content: match[2] });
    }
  }

  if (blocks.length > 0) return blocks;

  // Match inline block headers like ```ts:src/app.ts\ncontent\n```
  const inlineBlockRegex = /```[a-zA-Z]*:([a-zA-Z0-9_.\-\/\\]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/gm;
  while ((match = inlineBlockRegex.exec(input)) !== null) {
    if (match[1] && match[2]) {
      blocks.push({ path: match[1].trim(), content: match[2] });
    }
  }

  return blocks;
}

export function registerApplyCommand(
  program: Command,
  dependencies: ApplyDependencies,
): void {
  program
    .command("apply [patchFile]")
    .description("Apply AI-generated code diffs or code blocks safely to working tree")
    .option("--root <path>", "Repository root", ".")
    .action(async (patchFile: string | undefined, options: { root: string }) => {
      try {
        let content = "";
        if (patchFile && patchFile !== "-") {
          content = await readFile(resolve(dependencies.currentDirectory, patchFile), "utf8");
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
          content = Buffer.concat(chunks).toString("utf8");
        }

        const blocks = parseAiCodeBlocks(content);
        if (blocks.length === 0) {
          dependencies.writeData({
            kind: "apply",
            status: "warning",
            message: "No structured AI code blocks with target file paths detected.",
          });
          dependencies.setExitCode(EXIT_CODES.validation);
          return;
        }

        const applied: string[] = [];
        const root = resolve(dependencies.currentDirectory, options.root);

        for (const block of blocks) {
          const targetPath = resolve(root, block.path);
          await mkdir(dirname(targetPath), { recursive: true });
          const handle = await open(targetPath, "w");
          try {
            await handle.writeFile(block.content, "utf8");
            applied.push(block.path);
          } finally {
            await handle.close();
          }
        }

        dependencies.writeData({
          kind: "apply",
          status: "success",
          applied,
          count: applied.length,
        });
        dependencies.setExitCode(EXIT_CODES.success);
      } catch (error) {
        dependencies.writeData({
          kind: "apply",
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        dependencies.setExitCode(EXIT_CODES.internal);
      }
    });
}
