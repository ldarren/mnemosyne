import { describe, it, beforeAll, afterAll } from "vitest";
import { loadFixture, type LoadedFixture } from "../helpers/fixture-loader.js";
import { IweRunner } from "../helpers/iwe-runner.js";
import { assertIncludesChild } from "../helpers/assertions.js";

describe("hierarchy links", () => {
  let fixture: LoadedFixture;
  let runner: IweRunner;

  beforeAll(async () => {
    fixture = await loadFixture("valid-project");
    runner = new IweRunner(fixture.path);
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  describe("project index includes its children", () => {
    it("includes requirements", async () => {
      await assertIncludesChild(runner, "dvdol/index", "dvdol/req-sso-integration");
    });

    it("includes systems", async () => {
      await assertIncludesChild(runner, "dvdol/index", "dvdol/sys-auth-service");
    });

    it("includes ADRs", async () => {
      await assertIncludesChild(runner, "dvdol/index", "dvdol/adr-001-saml-over-oidc");
    });

    it("includes tasks", async () => {
      await assertIncludesChild(runner, "dvdol/index", "dvdol/task-setup-ci");
    });

    it("includes todo", async () => {
      await assertIncludesChild(runner, "dvdol/index", "dvdol/todo");
    });

    it("includes team", async () => {
      await assertIncludesChild(runner, "dvdol/index", "dvdol/team-backend");
    });
  });

  describe("requirement includes its children", () => {
    it("includes design", async () => {
      await assertIncludesChild(runner, "dvdol/req-sso-integration", "dvdol/design-sso-integration");
    });

    it("includes tasks", async () => {
      await assertIncludesChild(runner, "dvdol/req-sso-integration", "dvdol/task-setup-ci");
    });
  });

  describe("team includes roles", () => {
    it("includes role", async () => {
      await assertIncludesChild(runner, "dvdol/team-backend", "dvdol/role-backend-tech-lead");
    });
  });

  describe("user includes tasks and roles", () => {
    it("includes task via cross-directory link", async () => {
      await assertIncludesChild(runner, "users/joe-smith", "dvdol/task-setup-ci");
    });

    it("includes role via cross-directory link", async () => {
      await assertIncludesChild(runner, "users/joe-smith", "dvdol/role-backend-tech-lead");
    });
  });
});
