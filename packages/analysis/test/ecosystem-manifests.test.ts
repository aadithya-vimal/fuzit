import { describe, expect, it } from "vitest";
import {
  detectPythonPackageLayout,
  parseGoManifest,
  parseJavaManifest,
  parsePythonManifest,
} from "../src/index.js";

describe("ecosystem manifests", () => {
  it("handles malformed files without execution", () =>
    expect(parseGoManifest("???").module).toBeNull());
  it("supports multiple manifest adapters", () =>
    expect([
      parsePythonManifest("a==1"),
      parseJavaManifest("<groupId>x</groupId>"),
    ]).toHaveLength(2));
  it("reports dynamic Gradle limitations", () =>
    expect(parseJavaManifest('implementation "${lib}"').dynamic).toBe(true));
  it("parses Maven parent, modules, dependencies, and plugins", () => {
    const result = parseJavaManifest(
      "<project><parent><artifactId>parent</artifactId></parent><modules><module>api</module><module>web</module></modules><dependencies><dependency><groupId>org.demo</groupId><artifactId>core</artifactId></dependency></dependencies><build><plugins><plugin><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build></project>",
      "pom.xml",
    );
    expect(result).toMatchObject({
      parent: "parent",
      modules: ["api", "web"],
      dependencies: ["org.demo:core"],
      plugins: ["spring-boot-maven-plugin"],
    });
  });
  it("parses Gradle module relationships and reports Kotlin DSL conservatively", () => {
    const settings = parseJavaManifest(
      'include(":api")\ninclude(":libs:core")',
      "settings.gradle.kts",
    );
    expect(settings.modules).toEqual(["api", "libs/core"]);
    expect(settings.diagnostics).toContain("kotlin-dsl-conservative");
  });
  it("parses requirements includes", () =>
    expect(parsePythonManifest("-r base.txt").includes).toEqual(["base.txt"]));
  it("parses PEP 621 and Poetry packaging metadata deterministically", () => {
    const pep = parsePythonManifest(
      '[project]\nname="demo"\ndependencies=["FastAPI>=1", "uvicorn"]\n[project.scripts]\ndemo="demo:main"\n[tool.pytest.ini_options]\naddopts="-q"',
      "pyproject.toml",
    );
    const poetry = parsePythonManifest(
      '[tool.poetry]\nname="poem"\n[tool.poetry.dependencies]\npython="^3.11"\nflask="^3"',
      "pyproject.toml",
    );
    expect(pep).toMatchObject({
      name: "demo",
      dependencies: ["fastapi", "uvicorn"],
      entryPoints: ["demo:demo:main"],
      testConfiguration: ["pytest"],
    });
    expect(poetry.dependencies).toEqual(["flask"]);
    expect(
      parsePythonManifest(
        "-r base.txt\n--requirement dev.in\nrequests>=2",
        "requirements-dev.txt",
      ).includes,
    ).toEqual(["base.txt", "dev.in"]);
  });
  it("reports malformed TOML and detects canonical package layouts", () => {
    expect(
      parsePythonManifest('[project]\ndependencies=["x"', "pyproject.toml"),
    ).toMatchObject({
      completeness: "partial",
      diagnostics: ["malformed-toml"],
    });
    expect(
      detectPythonPackageLayout([
        "src/demo/__init__.py",
        "other/py.typed",
        "README.md",
      ]),
    ).toEqual(["other", "src/demo"]);
  });
  it("parses Go replace directives, go.work files, require blocks, and reports build tags", () => {
    const mod = parseGoManifest(
      "// +build linux\nmodule github.com/example/demo\ngo 1.21\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgithub.com/stretchr/testify v1.8.4\n)\nreplace a => ../a",
      "go.mod",
    );
    expect(mod).toMatchObject({
      format: "go.mod",
      module: "github.com/example/demo",
      goVersion: "1.21",
      dependencies: ["github.com/gin-gonic/gin", "github.com/stretchr/testify"],
      replacements: [{ from: "a", to: "../a" }],
      completeness: "partial",
      diagnostics: ["unsupported-build-tag"],
    });

    const work = parseGoManifest(
      "go 1.21\nuse (\n\t./app\n\t./lib\n)\nreplace (\n\tx => ../x\n)",
      "go.work",
    );
    expect(work).toMatchObject({
      format: "go.work",
      goVersion: "1.21",
      useDirectories: ["./app", "./lib"],
      replacements: [{ from: "x", to: "../x" }],
      completeness: "complete",
    });

    expect(
      parseGoManifest("require github.com/a/b v1", "go.mod"),
    ).toMatchObject({
      completeness: "partial",
      diagnostics: ["malformed-manifest"],
    });
  });
});
