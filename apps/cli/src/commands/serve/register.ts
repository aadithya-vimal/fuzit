import { createServer } from "node:http";
import { resolve } from "node:path";
import { EXIT_CODES, type Diagnostic, type ExitCode } from "@fuzit/schemas";
import type { Command } from "commander";
import { acquireRepository, analyzeRepository } from "../../application/repository.js";

interface ServeDependencies {
  readonly currentDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly writeData: (value: unknown) => void;
  readonly setExitCode: (code: ExitCode) => void;
}

export function registerServeCommand(
  program: Command,
  dependencies: ServeDependencies,
): void {
  program
    .command("serve [port]")
    .description("Start local RAG / Context REST API server over the repository")
    .option("--root <path>", "Repository root", ".")
    .option("--host <host>", "Host address to bind", "127.0.0.1")
    .action(async (portArg: string | undefined, options: { root: string; host: string }) => {
      const port = parseInt(portArg ?? "3000", 10);
      const root = resolve(dependencies.currentDirectory, options.root);

      const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        if (url.pathname === "/" || url.pathname === "/health") {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              status: "ok",
              service: "fuzit-rag",
              repository: root,
            }),
          );
          return;
        }

        if (url.pathname === "/api/context" || url.pathname === "/context") {
          try {
            let body = "";
            if (req.method === "POST") {
              for await (const chunk of req) body += chunk;
            }
            const query = url.searchParams.get("q") ?? (body ? JSON.parse(body).query : "");

            const acquisition = await acquireRepository(root, dependencies.environment);
            const intelligence = analyzeRepository(acquisition);

            let items = acquisition.items;
            if (query) {
              const q = String(query).toLowerCase();
              items = items.filter(
                (item) =>
                  item.path.toLowerCase().includes(q) ||
                  (item.content && item.content.toLowerCase().includes(q)),
              );
            }

            res.writeHead(200);
            res.end(
              JSON.stringify({
                status: "success",
                query,
                repository: root,
                filesCount: items.length,
                languages: intelligence.languages,
                items: items.map((i) => ({
                  path: i.path,
                  sha256: i.sha256,
                  content: i.content,
                })),
              }),
            );
          } catch (error) {
            res.writeHead(500);
            res.end(
              JSON.stringify({
                status: "error",
                message: error instanceof Error ? error.message : String(error),
              }),
            );
          }
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ status: "not_found" }));
      });

      server.listen(port, options.host, () => {
        dependencies.writeData({
          kind: "serve",
          status: "running",
          host: options.host,
          port,
          root,
          endpoint: `http://${options.host}:${port}/api/context`,
        });
      });
    });
}
