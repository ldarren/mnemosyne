import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { loadFixture, type LoadedFixture } from "../helpers/fixture-loader.js";
import { IweRunner } from "../helpers/iwe-runner.js";

describe("cross-directory links", () => {
  let fixture: LoadedFixture;
  let runner: IweRunner;

  beforeAll(async () => {
    fixture = await loadFixture("valid-project");
    runner = new IweRunner(fixture.path);
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("project task references shared user correctly", async () => {
    const results = await runner.find();
    const task = results.find((r) => r.key === "dvdol/task-setup-ci");
    const refKeys = task!.references.map((e) => e.key);
    expect(refKeys).toContain("users/joe-smith");
  });

  it("shared user includes project-scoped task correctly", async () => {
    const results = await runner.find();
    const user = results.find((r) => r.key === "users/joe-smith");
    const includeKeys = user!.includes.map((e) => e.key);
    expect(includeKeys).toContain("dvdol/task-setup-ci");
  });

  it("shared user includes project-scoped role correctly", async () => {
    const results = await runner.find();
    const user = results.find((r) => r.key === "users/joe-smith");
    const includeKeys = user!.includes.map((e) => e.key);
    expect(includeKeys).toContain("dvdol/role-backend-tech-lead");
  });

  it("ADR references shared users as deciders", async () => {
    const results = await runner.find();
    const adr = results.find((r) => r.key === "dvdol/adr-001-saml-over-oidc");
    const refKeys = adr!.references.map((e) => e.key);
    expect(refKeys).toContain("users/joe-smith");
    expect(refKeys).toContain("users/sarah-chen");
  });
});
