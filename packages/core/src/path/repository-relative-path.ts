import { posix, win32 } from "node:path";

declare const repositoryRelativePathBrand: unique symbol;

export type RepositoryRelativePath = string & {
  readonly [repositoryRelativePathBrand]: true;
};

export type PathNormalizationErrorCode =
  "PATH.ABSOLUTE" | "PATH.ESCAPE" | "PATH.ROOT_MISMATCH";

export class PathNormalizationError extends Error {
  readonly code: PathNormalizationErrorCode;

  constructor(code: PathNormalizationErrorCode, message: string) {
    super(message);
    this.name = "PathNormalizationError";
    this.code = code;
  }
}

function isWindowsAbsolute(path: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]{2}[^\\/]+[\\/][^\\/]+/.test(path)
  );
}

export function normalizeRepositoryRelativePath(
  input: string,
): RepositoryRelativePath {
  if (isWindowsAbsolute(input) || input.startsWith("/")) {
    throw new PathNormalizationError(
      "PATH.ABSOLUTE",
      "Repository-relative paths cannot be absolute.",
    );
  }

  const segments: string[] = [];
  for (const segment of input.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        throw new PathNormalizationError(
          "PATH.ESCAPE",
          "Path escapes the repository root.",
        );
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return (
    segments.length === 0 ? "." : segments.join("/")
  ) as RepositoryRelativePath;
}

function usesWindowsSemantics(path: string): boolean {
  return isWindowsAbsolute(path) || path.includes("\\");
}

export function toRepositoryRelativePath(
  repositoryRoot: string,
  targetPath: string,
): RepositoryRelativePath {
  const windowsSemantics =
    usesWindowsSemantics(repositoryRoot) || usesWindowsSemantics(targetPath);
  const pathApi = windowsSemantics ? win32 : posix;
  const relativePath = pathApi.relative(
    pathApi.resolve(repositoryRoot),
    pathApi.resolve(targetPath),
  );

  if (pathApi.isAbsolute(relativePath)) {
    throw new PathNormalizationError(
      "PATH.ROOT_MISMATCH",
      "Path does not share the repository root.",
    );
  }

  try {
    return normalizeRepositoryRelativePath(relativePath);
  } catch (error) {
    if (
      error instanceof PathNormalizationError &&
      error.code === "PATH.ESCAPE"
    ) {
      throw new PathNormalizationError(
        "PATH.ESCAPE",
        "Path is outside the repository root.",
      );
    }
    throw error;
  }
}
