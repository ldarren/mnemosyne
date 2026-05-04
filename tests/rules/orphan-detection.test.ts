import { describe, it, beforeAll, afterAll } from "vitest";
import { loadFixture, type LoadedFixture } from "../helpers/fixture-loader.js";
import { IweRunner } from "../helpers/iwe-runner.js";
import { assertNoOrphans } from "../helpers/assertions.js";

describe("orphan detection", () => {
  let fixture: LoadedFixture;
  let runner: IweRunner;

  beforeAll(async () => {
    fixture = await loadFixture("valid-project");
    runner = new IweRunner(fixture.path);
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("no orphaned entities in valid project", async () => {
    const allowedRoots = [
      "dvdol/index",
      "users/joe-smith",
      "users/sarah-chen",
    ];
    await assertNoOrphans(runner, allowedRoots);
  });
});
