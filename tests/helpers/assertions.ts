import { expect } from "vitest";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { IweRunner } from "./iwe-runner.js";

export async function assertEntityExists(runner: IweRunner, key: string): Promise<void> {
  const results = await runner.retrieve(key);
  expect(results.length, `Entity ${key} should exist`).toBeGreaterThan(0);
  expect(results[0].key).toBe(key);
}

export async function assertEntityInSubdir(kbPath: string, subdir: string, filename: string): Promise<void> {
  const files = await readdir(join(kbPath, subdir));
  expect(files, `${filename}.md should be in ${subdir}/`).toContain(`${filename}.md`);
}

export async function assertEntityInProject(kbPath: string, key: string, project: string): Promise<void> {
  const entityName = key.replace(`${project}/`, "");
  const files = await readdir(join(kbPath, project));
  expect(files, `${entityName}.md should be in ${project}/`).toContain(`${entityName}.md`);
}

export async function assertIncludesChild(runner: IweRunner, parentKey: string, childKey: string): Promise<void> {
  const results = await runner.find();
  const parent = results.find((r) => r.key === parentKey);
  expect(parent, `Parent ${parentKey} should exist`).toBeDefined();
  const childKeys = parent!.includes.map((e) => e.key);
  expect(childKeys, `${parentKey} should include ${childKey}`).toContain(childKey);
}

export async function assertIncludedBy(runner: IweRunner, childKey: string, parentKey: string): Promise<void> {
  const results = await runner.find();
  const child = results.find((r) => r.key === childKey);
  expect(child, `Child ${childKey} should exist`).toBeDefined();
  const parentKeys = child!.includedBy.map((e) => e.key);
  expect(parentKeys, `${childKey} should be included by ${parentKey}`).toContain(parentKey);
}

export async function assertNoOrphans(runner: IweRunner, excludeRoots: string[] = []): Promise<void> {
  const results = await runner.find();
  const orphans = results.filter(
    (r) => r.includedBy.length === 0 && !excludeRoots.includes(r.key),
  );
  const orphanKeys = orphans.map((r) => r.key);
  expect(orphanKeys, `These entities are orphans (not included by any parent)`).toEqual([]);
}

export function assertKeyMatchesPattern(key: string, pattern: RegExp): void {
  expect(key, `Key "${key}" should match pattern ${pattern}`).toMatch(pattern);
}

export async function assertProjectHasIndex(runner: IweRunner, project: string): Promise<void> {
  await assertEntityExists(runner, `${project}/index`);
}
