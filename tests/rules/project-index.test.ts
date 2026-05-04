import { describe, it, beforeAll, afterAll } from "vitest";
import { readdir } from "node:fs/promises";
import { loadFixture, type LoadedFixture } from "../helpers/fixture-loader.js";
import { IweRunner } from "../helpers/iwe-runner.js";
import { assertProjectHasIndex, assertEntityExists } from "../helpers/assertions.js";

const SHARED_DIRS = ["users"];

describe("project index", () => {
  let fixture: LoadedFixture;
  let runner: IweRunner;

  beforeAll(async () => {
    fixture = await loadFixture("valid-project");
    runner = new IweRunner(fixture.path);
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("every project subdirectory has an index.md", async () => {
    const entries = await readdir(fixture.path, { withFileTypes: true });
    const projectDirs = entries
      .filter((e) => e.isDirectory() && e.name !== ".iwe" && !SHARED_DIRS.includes(e.name))
      .map((e) => e.name);

    for (const project of projectDirs) {
      await assertProjectHasIndex(runner, project);
    }
  });

  it("project index is recognized by IWE", async () => {
    await assertEntityExists(runner, "dvdol/index");
  });
});
