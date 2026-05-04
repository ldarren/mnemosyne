import { execFile } from "node:child_process";
import type { FindResult, RetrieveResult } from "./types.js";

function run(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("iwe", args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`iwe ${args.join(" ")} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export class IweRunner {
  constructor(private cwd: string) {}

  async find(query?: string): Promise<FindResult[]> {
    const args = ["find", "-f", "json"];
    if (query) args.push(query);
    const out = await run(args, this.cwd);
    return JSON.parse(out);
  }

  async retrieve(key: string, opts?: { depth?: number; children?: boolean }): Promise<RetrieveResult[]> {
    const args = ["retrieve", "-k", key, "-f", "json"];
    if (opts?.depth !== undefined) args.push("-d", String(opts.depth));
    if (opts?.children) args.push("--children");
    const out = await run(args, this.cwd);
    return JSON.parse(out);
  }

  async stats(): Promise<string> {
    return run(["stats"], this.cwd);
  }

  async tree(key?: string, depth?: number): Promise<string> {
    const args = ["tree", "-f", "json"];
    if (key) args.push("-k", key);
    if (depth !== undefined) args.push("-d", String(depth));
    return run(args, this.cwd);
  }

  async allKeys(): Promise<string[]> {
    const results = await this.find();
    return results.map((r) => r.key);
  }
}
