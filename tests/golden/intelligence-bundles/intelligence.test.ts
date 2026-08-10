import { describe, expect, it } from "vitest";
import { normalizeRepositoryIntelligence } from "../../../packages/core/src/index.js";
const base = {
  languages: ["TypeScript"],
  packages: [],
  frameworks: [],
  tests: [],
  entryPoints: [],
  dependencies: [],
  conflicts: [],
  partial: false,
};
describe("intelligence bundle metadata", () => {
  it("supports no facts", () =>
    expect(
      normalizeRepositoryIntelligence({ ...base, languages: [] }),
    ).toMatchObject({ languages: [], partial: false }));
  it("marks partial adapters", () =>
    expect(
      normalizeRepositoryIntelligence({ ...base, partial: true }).partial,
    ).toBe(true));
  it("preserves conflicts", () =>
    expect(
      normalizeRepositoryIntelligence({ ...base, conflicts: ["a", "b"] })
        .conflicts,
    ).toEqual(["a", "b"]));
  it("is format-neutral structured metadata", () =>
    expect(
      JSON.parse(JSON.stringify(normalizeRepositoryIntelligence(base))),
    ).toEqual(base));
  it("keeps budget metadata separate", () =>
    expect(normalizeRepositoryIntelligence(base)).not.toHaveProperty("budget"));
  it("normalizes polyglot monorepo repository intelligence deterministically", () => {
    const polyglot = normalizeRepositoryIntelligence({
      languages: ["TypeScript", "Python", "Java", "Go"],
      packages: [
        "apps/web:package.json",
        "java:services/backend/pom.xml",
        "go:github.com/example/worker",
        "python:services/api/pyproject.toml",
      ],
      frameworks: ["next", "express", "fastapi", "spring-boot", "gin"],
      tests: ["vitest", "pytest", "junit", "testify"],
      entryPoints: ["apps/web:start", "services/worker/main.go"],
      dependencies: [
        "next",
        "express",
        "fastapi",
        "org.springframework.boot:spring-boot-starter-web",
        "github.com/gin-gonic/gin",
      ],
      conflicts: [
        "multiple confirmed server frameworks: express, next",
      ],
      partial: false,
    });

    expect(polyglot).toEqual({
      languages: ["Go", "Java", "Python", "TypeScript"],
      packages: [
        "apps/web:package.json",
        "go:github.com/example/worker",
        "java:services/backend/pom.xml",
        "python:services/api/pyproject.toml",
      ],
      frameworks: ["express", "fastapi", "gin", "next", "spring-boot"],
      tests: ["junit", "pytest", "testify", "vitest"],
      entryPoints: ["apps/web:start", "services/worker/main.go"],
      dependencies: [
        "express",
        "fastapi",
        "github.com/gin-gonic/gin",
        "next",
        "org.springframework.boot:spring-boot-starter-web",
      ],
      conflicts: ["multiple confirmed server frameworks: express, next"],
      partial: false,
    });
  });
  it("preserves partial status for polyglot repositories with malformed or dynamic manifests", () => {
    const partialPolyglot = normalizeRepositoryIntelligence({
      languages: ["Go", "Java"],
      packages: ["go:go.mod", "java:pom.xml"],
      frameworks: ["spring-boot"],
      tests: ["junit"],
      entryPoints: [],
      dependencies: [],
      conflicts: [],
      partial: true,
    });
    expect(partialPolyglot.partial).toBe(true);
  });
});
