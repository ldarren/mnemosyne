import { defineConfig } from "vitest/config";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: __dirname,
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
});
