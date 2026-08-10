export interface DetectorInput {
  readonly packageName: string;
  readonly dependencies: readonly string[];
  readonly scripts: Readonly<Record<string, string>>;
  readonly packageRoot?: string;
  readonly dependencyVersions?: Readonly<Record<string, string>>;
  readonly configurationPaths?: readonly string[];
  readonly sourcePaths?: readonly string[];
  readonly imports?: readonly string[];
  readonly apiUsage?: readonly string[];
}

export interface FrameworkEvidence {
  readonly framework: string;
  readonly packageName: string;
  readonly packageRoot: string;
  readonly support: "confirmed" | "declared";
  readonly versionHint: string | null;
  readonly evidence: readonly string[];
  readonly detector: "framework-manifest-analysis";
  readonly detectorVersion: "1";
}

export interface DetectorResult {
  readonly frameworks: readonly string[];
  readonly tests: readonly string[];
  readonly entryPoints: readonly string[];
  readonly conflicts: readonly string[];
  readonly evidence: readonly FrameworkEvidence[];
  readonly testEvidence: readonly FrameworkEvidence[];
  readonly partial: boolean;
}

export function detectFrameworks(input: DetectorInput): DetectorResult {
  const frameworks = [
    "next",
    "react",
    "express",
    "fastify",
    "@nestjs/core",
    "fastapi",
    "flask",
    "django",
  ].filter((name) => input.dependencies.includes(name));
  const tests = ["vitest", "jest", "pytest"].filter((name) =>
    input.dependencies.includes(name),
  );
  const entryPoints = Object.entries(input.scripts)
    .filter(([name]) => ["start", "serve", "dev"].includes(name))
    .map(([name, command]) => `${name}:${command}`)
    .sort();
  const paths = [
    ...(input.configurationPaths ?? []),
    ...(input.sourcePaths ?? []),
  ].map((path) => path.replaceAll("\\", "/"));
  const imports = new Set(input.imports ?? []);
  const evidence: FrameworkEvidence[] = [];
  if (input.dependencies.includes("react")) {
    const usage = imports.has("react") || imports.has("react-dom");
    evidence.push({
      framework: "react",
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: usage ? "confirmed" : "declared",
      versionHint: input.dependencyVersions?.react ?? null,
      evidence: ["dependency:react", ...(usage ? ["import:react"] : [])],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  if (input.dependencies.includes("next")) {
    const appRouter = paths.some((path) =>
      /(^|\/)app\/(?:layout|page)\.[cm]?[jt]sx?$/u.test(path),
    );
    const pagesRouter = paths.some((path) =>
      /(^|\/)pages\/.+\.[cm]?[jt]sx?$/u.test(path),
    );
    const config = paths.some((path) =>
      /(^|\/)next\.config\.[cm]?[jt]s$/u.test(path),
    );
    const usage =
      appRouter ||
      pagesRouter ||
      config ||
      imports.has("next") ||
      [...imports].some((item) => item.startsWith("next/"));
    evidence.push({
      framework: "next",
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: usage ? "confirmed" : "declared",
      versionHint: input.dependencyVersions?.next ?? null,
      evidence: [
        "dependency:next",
        ...(appRouter ? ["layout:app-router"] : []),
        ...(pagesRouter ? ["layout:pages-router"] : []),
        ...(config ? ["configuration:next"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  const apiUsage = [...(input.apiUsage ?? [])].sort();
  for (const [dependency, framework, importNames, usagePrefix] of [
    ["express", "express", ["express"], "express:"],
    ["fastify", "fastify", ["fastify"], "fastify:"],
    ["@nestjs/core", "nestjs", ["@nestjs/core", "@nestjs/common"], "nestjs:"],
  ] as const) {
    if (!input.dependencies.includes(dependency)) continue;
    const imported = importNames.some((name) => imports.has(name));
    const routes = apiUsage.filter((item) => item.startsWith(usagePrefix));
    const config = paths.filter(
      (path) => framework === "nestjs" && /(^|\/)nest-cli\.json$/u.test(path),
    );
    const confirmed = imported || routes.length > 0 || config.length > 0;
    evidence.push({
      framework,
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint: input.dependencyVersions?.[dependency] ?? null,
      evidence: [
        `dependency:${dependency}`,
        ...(imported ? [`import:${dependency}`] : []),
        ...routes.map((route) => `route:${route.slice(usagePrefix.length)}`),
        ...config.map(() => "configuration:nest-cli"),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  for (const [dependency, framework, importNames, usagePrefix] of [
    ["fastapi", "fastapi", ["fastapi"], "fastapi:"],
    ["flask", "flask", ["flask"], "flask:"],
    ["django", "django", ["django"], "django:"],
  ] as const) {
    if (!input.dependencies.includes(dependency)) continue;
    const imported = importNames.some((name) => imports.has(name));
    const routes = apiUsage.filter((item) => item.startsWith(usagePrefix));
    const config = paths.some((path) =>
      framework === "django"
        ? /(^|\/)(?:settings|urls|manage)\.py$/u.test(path)
        : false,
    );
    const entryPoint = entryPoints.some((entry) =>
      new RegExp(`(?:^|[: ])${framework}(?:[.: ]|$)`, "iu").test(entry),
    );
    const confirmed = imported || routes.length > 0 || config || entryPoint;
    evidence.push({
      framework,
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint: input.dependencyVersions?.[dependency] ?? null,
      evidence: [
        `dependency:${dependency}`,
        ...(imported ? [`import:${dependency}`] : []),
        ...routes.map((route) => `route:${route.slice(usagePrefix.length)}`),
        ...(config ? ["configuration:django"] : []),
        ...(entryPoint ? ["entry-point"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  for (const [depName, framework, importPrefix] of [
    ["github.com/gin-gonic/gin", "gin", "github.com/gin-gonic/gin"],
    ["github.com/labstack/echo", "echo", "github.com/labstack/echo"],
    ["github.com/gofiber/fiber", "fiber", "github.com/gofiber/fiber"],
    ["github.com/go-chi/chi", "chi", "github.com/go-chi/chi"],
    ["github.com/gorilla/mux", "gorilla/mux", "github.com/gorilla/mux"],
  ] as const) {
    const dep = input.dependencies.find(
      (d) => d === depName || d.startsWith(`${depName}/`) || d === framework,
    );
    if (!dep) continue;
    frameworks.push(framework);
    const imported = [...imports].some(
      (item) => item === importPrefix || item.startsWith(`${importPrefix}/`),
    );
    const routes = apiUsage.filter(
      (item) =>
        item.startsWith(`go:route:`) || item.startsWith(`${framework}:route:`),
    );
    const entryPoint = paths.some((path) => /(^|\/)main\.go$/u.test(path));
    const confirmed = imported || routes.length > 0 || entryPoint;
    evidence.push({
      framework,
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint: input.dependencyVersions?.[dep] ?? null,
      evidence: [
        `dependency:${dep}`,
        ...(imported ? [`import:${framework}`] : []),
        ...routes.map((r) => `route:${r.split(":").slice(2).join(":")}`),
        ...(entryPoint ? ["entry-point"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  const springBootDep = input.dependencies.find(
    (dep) =>
      dep === "spring-boot" ||
      dep.includes("spring-boot") ||
      dep.startsWith("org.springframework.boot") ||
      dep.startsWith("org.springframework:"),
  );
  if (springBootDep) {
    frameworks.push("spring-boot");
    const imported =
      imports.has(
        "org.springframework.boot.autoconfigure.SpringBootApplication",
      ) ||
      imports.has("org.springframework.web.bind.annotation.RestController") ||
      imports.has("org.springframework.context.annotation.Configuration") ||
      imports.has("org.springframework.stereotype.Controller") ||
      [...imports].some((item) => item.startsWith("org.springframework"));
    const annotations = apiUsage.filter(
      (item) =>
        item.startsWith("spring:annotation:") ||
        item.startsWith("spring:controller:") ||
        item.startsWith("spring:configuration:"),
    );
    const routes = apiUsage.filter((item) => item.startsWith("spring:route:"));
    const config = paths.some((path) =>
      /(^|\/)application(?:-[^/]+)?\.(?:properties|yml|yaml)$/u.test(path),
    );
    const entryPoint =
      Object.keys(input.scripts).some((name) => /spring-boot/iu.test(name)) ||
      paths.some((path) => /Application\.java$/u.test(path)) ||
      apiUsage.includes("spring:entry-point");
    const confirmed =
      imported ||
      annotations.length > 0 ||
      routes.length > 0 ||
      config ||
      entryPoint;
    evidence.push({
      framework: "spring-boot",
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint:
        input.dependencyVersions?.["spring-boot"] ??
        input.dependencyVersions?.[springBootDep] ??
        null,
      evidence: [
        `dependency:${springBootDep}`,
        ...(imported ? ["import:spring"] : []),
        ...annotations.map((item) =>
          item.startsWith("spring:annotation:")
            ? `annotation:${item.slice("spring:annotation:".length)}`
            : item,
        ),
        ...routes.map((item) => `route:${item.slice("spring:route:".length)}`),
        ...(config ? ["configuration:application-properties"] : []),
        ...(entryPoint ? ["entry-point"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  const backend = evidence.filter(({ framework }) =>
    [
      "express",
      "fastify",
      "nestjs",
      "fastapi",
      "flask",
      "django",
      "spring-boot",
    ].includes(framework),
  );
  const backendConflicts =
    backend.filter(({ support }) => support === "confirmed").length > 1
      ? [
          `multiple confirmed server frameworks: ${backend
            .filter(({ support }) => support === "confirmed")
            .map(({ framework }) => framework)
            .sort()
            .join(", ")}`,
        ]
      : [];
  const testEvidence: FrameworkEvidence[] = [];
  for (const framework of ["vitest", "jest"] as const) {
    if (!input.dependencies.includes(framework)) continue;
    const imported =
      imports.has(framework) ||
      (framework === "jest" && imports.has("@jest/globals"));
    const config = paths.some((path) =>
      new RegExp(`(^|/)${framework}\\.config\\.[cm]?[jt]s$`, "u").test(path),
    );
    const scriptNames = Object.entries(input.scripts)
      .filter(([, command]) =>
        new RegExp(`(^|\\s)${framework}(\\s|$)`, "u").test(command),
      )
      .map(([name]) => name)
      .sort();
    const globals = apiUsage.filter((item) =>
      item.startsWith(`${framework}:global:`),
    );
    const layout = paths.some((path) =>
      /(^|\/)(?:__tests__|tests?)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path),
    );
    const confirmed =
      imported ||
      config ||
      scriptNames.length > 0 ||
      globals.length > 0 ||
      layout;
    testEvidence.push({
      framework,
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint: input.dependencyVersions?.[framework] ?? null,
      evidence: [
        `dependency:${framework}`,
        ...(imported ? [`import:${framework}`] : []),
        ...(config ? [`configuration:${framework}`] : []),
        ...scriptNames.map((name) => `script-metadata:${name}`),
        ...globals.map(
          (item) => `global-api:${item.slice(`${framework}:global:`.length)}`,
        ),
        ...(layout ? ["layout:test"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  const junitDep = input.dependencies.find(
    (dep) =>
      dep === "junit" || dep.includes("junit") || dep.startsWith("org.junit"),
  );
  if (junitDep) {
    tests.push("junit");
    const isJunit5 =
      junitDep.includes("jupiter") ||
      junitDep.includes("junit5") ||
      junitDep.includes("junit-jupiter");
    const isJunit4 =
      junitDep === "junit" ||
      junitDep === "junit:junit" ||
      junitDep.includes("junit4");
    const imported =
      imports.has("org.junit.Test") ||
      imports.has("org.junit.jupiter.api.Test") ||
      [...imports].some((item) => item.startsWith("org.junit"));
    const annotations = apiUsage.filter((item) =>
      item.startsWith("junit:annotation:"),
    );
    const layout = paths.some((path) =>
      /(^|\/)src\/test\/java\/|\.(?:Test|Tests)\.java$/u.test(path),
    );
    const confirmed = imported || annotations.length > 0 || layout;
    testEvidence.push({
      framework: "junit",
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint:
        input.dependencyVersions?.junit ??
        input.dependencyVersions?.[junitDep] ??
        (isJunit5 ? "5" : isJunit4 ? "4" : null),
      evidence: [
        `dependency:${junitDep}`,
        ...(imported ? ["import:junit"] : []),
        ...annotations.map(
          (item) => `annotation:${item.slice("junit:annotation:".length)}`,
        ),
        ...(layout ? ["layout:test"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  const goTestDep = input.dependencies.find(
    (dep) =>
      dep === "testing" ||
      dep === "github.com/stretchr/testify" ||
      dep.includes("testify"),
  );
  const goTestLayout = paths.some((path) => /_test\.go$/u.test(path));
  if (goTestDep || goTestLayout) {
    const framework = goTestDep?.includes("testify") ? "testify" : "testing";
    tests.push(framework);
    const imported =
      imports.has("testing") ||
      imports.has("github.com/stretchr/testify") ||
      [...imports].some((item) =>
        item.startsWith("github.com/stretchr/testify"),
      );
    const confirmed = imported || goTestLayout;
    testEvidence.push({
      framework,
      packageName: input.packageName,
      packageRoot: input.packageRoot ?? ".",
      support: confirmed ? "confirmed" : "declared",
      versionHint: goTestDep
        ? (input.dependencyVersions?.[goTestDep] ?? null)
        : null,
      evidence: [
        ...(goTestDep ? [`dependency:${goTestDep}`] : []),
        ...(imported ? [`import:${framework}`] : []),
        ...(goTestLayout ? ["layout:test"] : []),
      ],
      detector: "framework-manifest-analysis",
      detectorVersion: "1",
    });
  }
  const testConflicts =
    testEvidence.filter(({ support }) => support === "confirmed").length > 1
      ? [
          `multiple confirmed test frameworks: ${testEvidence
            .map(({ framework }) => framework)
            .sort()
            .join(", ")}`,
        ]
      : [];
  return {
    frameworks,
    tests,
    entryPoints,
    conflicts: [
      ...(backendConflicts.length > 0
        ? backendConflicts
        : frameworks.includes("express") && frameworks.includes("fastify")
          ? ["multiple server frameworks"]
          : []),
      ...testConflicts,
    ].sort(),
    evidence: evidence.sort((a, b) => a.framework.localeCompare(b.framework)),
    testEvidence: testEvidence.sort((a, b) =>
      a.framework.localeCompare(b.framework),
    ),
    partial: false,
  };
}
