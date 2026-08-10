export const JAVA_BUILD_DETECTOR_VERSION = "1";

export function parseJavaManifest(source: string, path = "pom.xml") {
  const normalizedPath = path.replaceAll("\\", "/");
  const maven =
    normalizedPath.endsWith("pom.xml") || /<project[\s>]/u.test(source);
  const dynamic = /\$\{|project\.|System\.|providers\.|findProperty\(/u.test(
    source,
  );
  let dependencies = maven
    ? [
        ...source.matchAll(
          /<dependency>[\s\S]*?<groupId>\s*([^<]+)<\/groupId>[\s\S]*?<artifactId>\s*([^<]+)<\/artifactId>[\s\S]*?<\/dependency>/gu,
        ),
      ].map((match) => `${match[1]!.trim()}:${match[2]!.trim()}`)
    : [
        ...source.matchAll(
          /(?:implementation|api|testImplementation)\s*(?:\(|\s)\s*["']([^"']+)["']/gu,
        ),
      ].map((match) => match[1]!);
  if (maven && dependencies.length === 0) {
    dependencies = [
      ...source.matchAll(/<groupId>\s*([^<]+)\s*<\/groupId>/gu),
    ].map((match) => match[1]!.trim());
  }
  const modules = maven
    ? [...source.matchAll(/<module>\s*([^<]+)\s*<\/module>/gu)].map(
        (match) => match[1]!,
      )
    : [
        ...source.matchAll(/(?:^|\n)\s*include\s*\(?\s*["']([^"']+)["']/gu),
      ].flatMap((match) =>
        match[1]!
          .split(/\s*,\s*/u)
          .map((item) => item.replace(/^:/u, "").replaceAll(":", "/")),
      );
  const parent = maven
    ? (/<parent>[\s\S]*?<artifactId>\s*([^<]+)<\/artifactId>[\s\S]*?<\/parent>/u
        .exec(source)?.[1]
        ?.trim() ?? null)
    : null;
  const plugins = maven
    ? [
        ...source.matchAll(
          /<plugin>[\s\S]*?<artifactId>\s*([^<]+)<\/artifactId>[\s\S]*?<\/plugin>/gu,
        ),
      ].map((match) => match[1]!.trim())
    : [
        ...source.matchAll(/(?:id\s*\(?\s*["']|alias\s*\()([^"')]+)["']?\)?/gu),
      ].map((match) => match[1]!.trim());
  const sourceRoots = [
    ...source.matchAll(/(?:srcDir|sourceDirectory)>?\s*["']?([^<"'\r\n)]+)/gu),
  ].map((match) => match[1]!.trim());
  const entryPoints = [
    ...source.matchAll(
      /(?:mainClass(?:Name)?\s*=|mainClass\.set\()\s*["']([^"']+)["']/gu,
    ),
  ].map((match) => match[1]!);
  const diagnostics = [
    ...(dynamic ? ["dynamic-build-metadata"] : []),
    ...(!maven && /\.kts$/u.test(normalizedPath)
      ? ["kotlin-dsl-conservative"]
      : []),
  ].sort();
  return {
    ecosystem: "java",
    path: normalizedPath,
    format: maven ? "maven" : "gradle",
    dependencies: [...new Set(dependencies)].sort(),
    modules: [...new Set(modules)].sort(),
    parent,
    plugins: [...new Set(plugins)].sort(),
    sourceRoots: [...new Set(sourceRoots)].sort(),
    entryPoints: [...new Set(entryPoints)].sort(),
    dynamic,
    completeness: diagnostics.length === 0 ? "complete" : "partial",
    diagnostics,
    detectorVersion: JAVA_BUILD_DETECTOR_VERSION,
  };
}
