import { describe, expect, it } from "vitest";
import { detectFrameworks } from "../src/index.js";
const detect = (dependencies: string[], scripts: Record<string, string> = {}) =>
  detectFrameworks({ packageName: "x", dependencies, scripts });
describe("framework detectors", () => {
  it("represents conflicting frameworks", () =>
    expect(detect(["express", "fastify"]).conflicts).toEqual([
      "multiple server frameworks",
    ]));
  it("keeps monorepo packages independent", () =>
    expect([detect(["react"]), detect(["express"])]).toHaveLength(2));
  it("detects test-only dependencies", () =>
    expect(detect(["vitest"]).tests).toEqual(["vitest"]));
  it("avoids name-only false positives", () =>
    expect(detect(["not-react"]).frameworks).toEqual([]));
  it("preserves custom entry points", () =>
    expect(detect([], { start: "node custom.js" }).entryPoints).toEqual([
      "start:node custom.js",
    ]));
  it("distinguishes React-only from confirmed Next.js App Router", () => {
    const react = detectFrameworks({
      packageName: "ui",
      packageRoot: "packages/ui",
      dependencies: ["react"],
      dependencyVersions: { react: "^19" },
      scripts: {},
      imports: ["react"],
    });
    const next = detectFrameworks({
      packageName: "web",
      packageRoot: "apps/web",
      dependencies: ["next", "react"],
      dependencyVersions: { next: "15" },
      scripts: {},
      sourcePaths: ["apps/web/app/layout.tsx"],
    });
    expect(react.evidence).toEqual([
      {
        framework: "react",
        packageName: "ui",
        packageRoot: "packages/ui",
        support: "confirmed",
        versionHint: "^19",
        evidence: ["dependency:react", "import:react"],
        detector: "framework-manifest-analysis",
        detectorVersion: "1",
      },
    ]);
    expect(
      next.evidence.find(({ framework }) => framework === "next"),
    ).toMatchObject({
      support: "confirmed",
      evidence: ["dependency:next", "layout:app-router"],
    });
  });
  it("detects Pages Router and package-scoped configuration evidence", () => {
    const result = detectFrameworks({
      packageName: "web",
      dependencies: ["next"],
      scripts: {},
      sourcePaths: ["pages/index.tsx"],
      configurationPaths: ["next.config.mjs"],
    });
    expect(result.evidence[0]?.evidence).toEqual([
      "dependency:next",
      "layout:pages-router",
      "configuration:next",
    ]);
  });
  it("keeps installed-but-unused Next.js declared and ignores filename lookalikes", () => {
    expect(
      detectFrameworks({
        packageName: "x",
        dependencies: ["next"],
        scripts: {},
        sourcePaths: ["next-notes.ts"],
      }).evidence[0]?.support,
    ).toBe("declared");
    expect(
      detectFrameworks({
        packageName: "x",
        dependencies: [],
        scripts: {},
        sourcePaths: ["app/page.tsx"],
      }).evidence,
    ).toEqual([]);
  });
  it.each([
    ["express", "express", "express", "express:get:/users"],
    ["fastify", "fastify", "fastify", "fastify:post:/users"],
    ["@nestjs/core", "nestjs", "@nestjs/core", "nestjs:Get:/users"],
  ] as const)(
    "detects attributable %s route evidence",
    (dependency, framework, imported, route) => {
      const result = detectFrameworks({
        packageName: "api",
        dependencies: [dependency],
        scripts: { start: "metadata-only" },
        imports: [imported],
        apiUsage: [route],
      });
      expect(result.evidence[0]).toMatchObject({
        framework,
        support: "confirmed",
        evidence: [
          `dependency:${dependency}`,
          `import:${dependency}`,
          `route:${route.split(":").slice(1).join(":")}`,
        ],
      });
    },
  );
  it("keeps unused backend dependencies declared and represents confirmed conflicts", () => {
    expect(
      detectFrameworks({
        packageName: "api",
        dependencies: ["express"],
        scripts: {},
      }).evidence[0]?.support,
    ).toBe("declared");
    const mixed = detectFrameworks({
      packageName: "api",
      dependencies: ["express", "fastify"],
      scripts: {},
      imports: ["express", "fastify"],
    });
    expect(mixed.conflicts).toEqual([
      "multiple confirmed server frameworks: express, fastify",
    ]);
  });
  it("requires dependency evidence for route-like API usage", () => {
    expect(
      detectFrameworks({
        packageName: "api",
        dependencies: [],
        scripts: {},
        apiUsage: ["express:get:/fake"],
      }).evidence,
    ).toEqual([]);
  });
  it.each([
    ["fastapi", "fastapi", "fastapi:get:/users"],
    ["flask", "flask", "flask:route:/users"],
    ["django", "django", "django:path:/users"],
  ] as const)(
    "detects confirmed Python framework %s evidence",
    (dependency, imported, route) => {
      const result = detectFrameworks({
        packageName: "py",
        dependencies: [dependency],
        scripts: {},
        imports: [imported],
        apiUsage: [route],
      });
      expect(result.evidence[0]).toMatchObject({
        framework: dependency,
        support: "confirmed",
        evidence: [
          `dependency:${dependency}`,
          `import:${dependency}`,
          `route:${route.split(":").slice(1).join(":")}`,
        ],
      });
    },
  );
  it("keeps installed-but-unused Python frameworks declared and reports mixed confirmed frameworks", () => {
    expect(
      detectFrameworks({
        packageName: "py",
        dependencies: ["fastapi"],
        scripts: {},
      }).evidence[0]?.support,
    ).toBe("declared");
    const mixed = detectFrameworks({
      packageName: "py",
      dependencies: ["fastapi", "flask"],
      scripts: {},
      imports: ["fastapi", "flask"],
    });
    expect(mixed.conflicts).toEqual([
      "multiple confirmed server frameworks: fastapi, flask",
    ]);
  });
  it("uses Django URL configuration and console entry-point evidence", () => {
    expect(
      detectFrameworks({
        packageName: "py",
        dependencies: ["django"],
        scripts: {},
        configurationPaths: ["project/urls.py"],
      }).evidence[0]?.evidence,
    ).toContain("configuration:django");
    expect(
      detectFrameworks({
        packageName: "py",
        dependencies: ["flask"],
        scripts: { start: "flask run" },
      }).evidence[0]?.evidence,
    ).toContain("entry-point");
  });
  it("confirms Vitest and Jest from config aliases, imports, globals, scripts, and layout", () => {
    const result = detectFrameworks({
      packageName: "mixed-tests",
      dependencies: ["vitest", "jest"],
      scripts: { unit: "vitest --config aliases.ts", legacy: "jest" },
      configurationPaths: ["vitest.config.ts", "jest.config.cjs"],
      sourcePaths: ["tests/a.test.ts"],
      imports: ["vitest", "@jest/globals"],
      apiUsage: ["vitest:global:describe", "jest:global:expect"],
    });
    expect(
      result.testEvidence.map(({ framework, support }) => [framework, support]),
    ).toEqual([
      ["jest", "confirmed"],
      ["vitest", "confirmed"],
    ]);
    expect(result.conflicts).toContain(
      "multiple confirmed test frameworks: jest, vitest",
    );
  });
  it("keeps unused test dependencies declared and produces no fact for no-test fixtures", () => {
    expect(
      detectFrameworks({
        packageName: "declared",
        dependencies: ["vitest"],
        scripts: {},
      }).testEvidence[0]?.support,
    ).toBe("declared");
    expect(
      detectFrameworks({
        packageName: "none",
        dependencies: [],
        scripts: {},
        sourcePaths: ["tests/a.test.ts"],
      }).testEvidence,
    ).toEqual([]);
  });
  it("detects Spring Boot framework with annotation, configuration, and entry-point evidence", () => {
    const result = detectFrameworks({
      packageName: "java-service",
      dependencies: ["org.springframework.boot:spring-boot-starter-web"],
      dependencyVersions: {
        "org.springframework.boot:spring-boot-starter-web": "3.2.0",
      },
      scripts: {},
      configurationPaths: ["src/main/resources/application.yml"],
      sourcePaths: ["src/main/java/com/example/DemoApplication.java"],
      imports: ["org.springframework.boot.autoconfigure.SpringBootApplication"],
      apiUsage: ["spring:annotation:@SpringBootApplication"],
    });
    expect(result.frameworks).toEqual(["spring-boot"]);
    expect(result.evidence[0]).toMatchObject({
      framework: "spring-boot",
      support: "confirmed",
      versionHint: "3.2.0",
    });
    expect(result.evidence[0]?.evidence).toEqual([
      "dependency:org.springframework.boot:spring-boot-starter-web",
      "import:spring",
      "annotation:@SpringBootApplication",
      "configuration:application-properties",
      "entry-point",
    ]);
  });
  it("detects JUnit 4 and JUnit 5 evidence and version hints", () => {
    const junit4Result = detectFrameworks({
      packageName: "legacy-java",
      dependencies: ["junit:junit"],
      scripts: {},
      imports: ["org.junit.Test"],
      apiUsage: ["junit:annotation:Test"],
    });
    expect(junit4Result.tests).toEqual(["junit"]);
    expect(junit4Result.testEvidence[0]).toMatchObject({
      framework: "junit",
      support: "confirmed",
      versionHint: "4",
    });

    const junit5Result = detectFrameworks({
      packageName: "modern-java",
      dependencies: ["org.junit.jupiter:junit-jupiter-api"],
      scripts: {},
      sourcePaths: ["src/test/java/com/example/AppTest.java"],
    });
    expect(junit5Result.tests).toEqual(["junit"]);
    expect(junit5Result.testEvidence[0]).toMatchObject({
      framework: "junit",
      support: "confirmed",
      versionHint: "5",
    });

    expect(
      detectFrameworks({
        packageName: "declared-java",
        dependencies: ["org.junit.jupiter:junit-jupiter-api"],
        scripts: {},
      }).testEvidence[0]?.support,
    ).toBe("declared");
  });
  it("detects Go frameworks and testing evidence", () => {
    const ginResult = detectFrameworks({
      packageName: "go-service",
      dependencies: ["github.com/gin-gonic/gin"],
      scripts: {},
      sourcePaths: ["main.go"],
      imports: ["github.com/gin-gonic/gin"],
    });
    expect(ginResult.frameworks).toEqual(["gin"]);
    expect(ginResult.evidence[0]).toMatchObject({
      framework: "gin",
      support: "confirmed",
    });

    const goTestResult = detectFrameworks({
      packageName: "go-lib",
      dependencies: ["github.com/stretchr/testify"],
      scripts: {},
      sourcePaths: ["lib_test.go"],
      imports: ["github.com/stretchr/testify"],
    });
    expect(goTestResult.tests).toEqual(["testify"]);
    expect(goTestResult.testEvidence[0]).toMatchObject({
      framework: "testify",
      support: "confirmed",
    });
  });
});
