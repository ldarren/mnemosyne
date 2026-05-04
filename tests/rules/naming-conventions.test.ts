import { describe, it, beforeAll, afterAll } from "vitest";
import { loadFixture, type LoadedFixture } from "../helpers/fixture-loader.js";
import { IweRunner } from "../helpers/iwe-runner.js";
import { assertKeyMatchesPattern } from "../helpers/assertions.js";

describe("naming conventions", () => {
  let fixture: LoadedFixture;
  let runner: IweRunner;
  let allKeys: string[];

  beforeAll(async () => {
    fixture = await loadFixture("valid-project");
    runner = new IweRunner(fixture.path);
    allKeys = await runner.allKeys();
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("user keys match users/{name} pattern", () => {
    const userKeys = allKeys.filter((k) => k.startsWith("users/"));
    for (const key of userKeys) {
      assertKeyMatchesPattern(key, /^users\/[a-z][a-z0-9-]+$/);
    }
  });

  it("team keys match {project}/team-{name} pattern", () => {
    const teamKeys = allKeys.filter((k) => k.includes("/team-"));
    for (const key of teamKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/team-[a-z][a-z0-9-]+$/);
    }
  });

  it("project index keys match {project}/index pattern", () => {
    const indexKeys = allKeys.filter((k) => k.endsWith("/index"));
    for (const key of indexKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/index$/);
    }
  });

  it("requirement keys match {project}/req-{name} pattern", () => {
    const reqKeys = allKeys.filter((k) => k.includes("/req-"));
    for (const key of reqKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/req-[a-z][a-z0-9-]+$/);
    }
  });

  it("design keys match {project}/design-{name} pattern", () => {
    const designKeys = allKeys.filter((k) => k.includes("/design-"));
    for (const key of designKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/design-[a-z][a-z0-9-]+$/);
    }
  });

  it("system keys match {project}/sys-{name} pattern", () => {
    const sysKeys = allKeys.filter((k) => k.includes("/sys-"));
    for (const key of sysKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/sys-[a-z][a-z0-9-]+$/);
    }
  });

  it("ADR keys match {project}/adr-{number}-{name} pattern", () => {
    const adrKeys = allKeys.filter((k) => k.includes("/adr-"));
    for (const key of adrKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/adr-\d+-[a-z][a-z0-9-]+$/);
    }
  });

  it("task keys match {project}/task-{name} pattern", () => {
    const taskKeys = allKeys.filter((k) => k.includes("/task-"));
    for (const key of taskKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/task-[a-zA-Z][a-zA-Z0-9-]+$/);
    }
  });

  it("role keys match {project}/role-{team}-{title} pattern", () => {
    const roleKeys = allKeys.filter((k) => k.includes("/role-"));
    for (const key of roleKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/role-[a-z][a-z0-9-]+$/);
    }
  });

  it("todo keys match {project}/todo pattern", () => {
    const todoKeys = allKeys.filter((k) => k.endsWith("/todo"));
    for (const key of todoKeys) {
      assertKeyMatchesPattern(key, /^[a-z][a-z0-9-]+\/todo$/);
    }
  });
});
