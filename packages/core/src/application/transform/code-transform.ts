/**
 * Code content transformations and skeletonization/compression.
 *
 * @module
 */

export interface CodeTransformOptions {
  readonly compress?: boolean;
  readonly removeComments?: boolean;
  readonly removeEmptyLines?: boolean;
  readonly lineNumbers?: boolean;
}

/**
 * Remove single-line and multi-line comments from code content.
 */
export function removeComments(content: string, filePath = ""): string {
  const ext = filePath.includes(".") ? filePath.split(".").pop()?.toLowerCase() ?? "" : "";
  
  if (["py", "sh", "bash", "yaml", "yml", "dockerfile", "r", "rb"].includes(ext)) {
    return content
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("#");
        if (idx === -1) return line;
        const quoteBefore = line.slice(0, idx).split(/["']/);
        if (quoteBefore.length % 2 === 0) return line;
        return line.slice(0, idx).trimEnd();
      })
      .join("\n");
  }

  // C-style comment languages (js, ts, java, c, cpp, go, rust, cs, etc.)
  let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      if (idx === -1) return line;
      const quoteBefore = line.slice(0, idx).split(/["']/);
      if (quoteBefore.length % 2 === 0) return line;
      return line.slice(0, idx).trimEnd();
    })
    .join("\n");

  return cleaned;
}

/**
 * Strip consecutive empty lines from code content.
 */
export function removeEmptyLines(content: string): string {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

/**
 * Prepend 1-indexed line numbers to each line of code content.
 */
export function addLineNumbers(content: string): string {
  const lines = content.split("\n");
  const padWidth = String(lines.length).length;
  return lines
    .map((line, idx) => `${String(idx + 1).padStart(padWidth, " ")} | ${line}`)
    .join("\n");
}

/**
 * Compress/skeletonize source code by keeping declarations, signatures, and structures
 * while stripping function/method bodies.
 */
export function compressCodeContent(content: string, filePath = ""): string {
  const ext = filePath.includes(".") ? filePath.split(".").pop()?.toLowerCase() ?? "" : "";

  if (["py", "rb"].includes(ext)) {
    return content
      .split("\n")
      .map((line) => {
        if (/^\s*(def |class |module |import|from|require|attr_)/.test(line)) return line;
        if (/^\s*#/.test(line)) return line;
        if (line.trim().length === 0) return line;
        if (!line.startsWith(" ")) return line;
        return null;
      })
      .filter((line): line is string => line !== null)
      .join("\n");
  }

  // C-style languages (TS, JS, Go, Rust, Java, C, C++, C#)
  return content
    .replace(/(\b(?:function|class|interface|type|async|export|public|private|protected|static|fn|def|struct|enum)\s+[a-zA-Z0-9_$]+\s*(?:\([^)]*\))?[^{]*)\{[\s\S]*?\}/g, "$1{ /* implementation hidden */ }")
    .replace(/(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[\s\S]*?\}/g, "$1 $2 = (...) => { /* implementation hidden */ }");
}

/**
 * Apply selected transformation controls sequentially to code content.
 */
export function transformCodeContent(
  content: string,
  filePath: string,
  options: CodeTransformOptions,
): string {
  let transformed = content;

  if (options.compress) {
    transformed = compressCodeContent(transformed, filePath);
  }
  if (options.removeComments) {
    transformed = removeComments(transformed, filePath);
  }
  if (options.removeEmptyLines) {
    transformed = removeEmptyLines(transformed);
  }
  if (options.lineNumbers) {
    transformed = addLineNumbers(transformed);
  }

  return transformed;
}
