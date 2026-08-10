import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderMarkdown = (source) =>
  source
    .split(/\r?\n/)
    .map((line) => {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
      }
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n");

export const publicDocPaths = async (root = repositoryRoot) => {
  const navigation = JSON.parse(
    await readFile(resolve(root, "docs/navigation.json"), "utf8"),
  );
  return [
    "README.md",
    "OWNERSHIP.md",
    ...navigation.sections.map(({ path }) => path),
  ];
};

export const buildDocsSite = async ({
  root = repositoryRoot,
  output = resolve(root, ".cache/docs-site"),
} = {}) => {
  const paths = await publicDocPaths(root);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await writeFile(
    resolve(output, "style.css"),
    "body{font:16px system-ui,sans-serif;line-height:1.5;margin:2rem auto;max-width:72rem;padding:0 1rem}\n",
  );
  for (const path of paths) {
    const source = await readFile(resolve(root, "docs", path), "utf8");
    const target = resolve(
      output,
      extname(path) === ".md" ? `${path.slice(0, -3)}.html` : path,
    );
    await mkdir(dirname(target), { recursive: true });
    const title = source.match(/^#\s+(.+)$/m)?.[1] ?? basename(path, ".md");
    const html = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>${escapeHtml(title)} | Fuzit</title>`,
      `<link rel="stylesheet" href="${relative(dirname(target), resolve(output, "style.css")).replaceAll("\\", "/")}">`,
      "</head>",
      `<body data-source="${escapeHtml(path)}">`,
      renderMarkdown(source),
      "</body>",
      "</html>",
      "",
    ].join("\n");
    await writeFile(target, html);
  }
  return { output, pages: paths.length };
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await buildDocsSite();
  process.stdout.write(
    `${JSON.stringify({ pages: result.pages, output: ".cache/docs-site" })}\n`,
  );
}
