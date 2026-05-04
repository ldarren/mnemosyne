import { cp, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "..", "fixtures");

export interface LoadedFixture {
  path: string;
  cleanup: () => Promise<void>;
}

export async function loadFixture(name: string): Promise<LoadedFixture> {
  const src = join(FIXTURES_DIR, name);
  const tmp = await mkdtemp(join(tmpdir(), `mnemosyne-test-${name}-`));
  await cp(src, tmp, { recursive: true });
  return {
    path: tmp,
    cleanup: () => rm(tmp, { recursive: true, force: true }),
  };
}
