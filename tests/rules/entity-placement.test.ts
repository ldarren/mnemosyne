import { describe, it, beforeAll, afterAll } from "vitest";
import { loadFixture, type LoadedFixture } from "../helpers/fixture-loader.js";
import { IweRunner } from "../helpers/iwe-runner.js";
import { assertEntityInSubdir, assertEntityInProject } from "../helpers/assertions.js";

describe("entity placement", () => {
  let fixture: LoadedFixture;
  let runner: IweRunner;

  beforeAll(async () => {
    fixture = await loadFixture("valid-project");
    runner = new IweRunner(fixture.path);
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  describe("shared entities in users/ subdirectory", () => {
    it("user entities are in users/ subdirectory", async () => {
      await assertEntityInSubdir(fixture.path, "users", "joe-smith");
      await assertEntityInSubdir(fixture.path, "users", "sarah-chen");
    });
  });

  describe("project-scoped entities in subdirectory", () => {
    it("project index is in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/index", "dvdol");
    });

    it("requirements are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/req-sso-integration", "dvdol");
    });

    it("designs are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/design-sso-integration", "dvdol");
    });

    it("systems are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/sys-auth-service", "dvdol");
    });

    it("ADRs are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/adr-001-saml-over-oidc", "dvdol");
    });

    it("tasks are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/task-setup-ci", "dvdol");
    });

    it("teams are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/team-backend", "dvdol");
    });

    it("roles are in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/role-backend-tech-lead", "dvdol");
    });

    it("todo is in project subdirectory", async () => {
      await assertEntityInProject(fixture.path, "dvdol/todo", "dvdol");
    });
  });
});
