import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Type, type Static } from "typebox";
import {
  type ExtensionAPI,
  getAgentDir,
  parseFrontmatter,
  withFileMutationQueue,
} from "@mariozechner/pi-coding-agent";

interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: "user" | "project";
}

function loadAgentsFromDir(
  dir: string,
  source: "user" | "project",
): AgentConfig[] {
  if (!fs.existsSync(dir)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const agents: AgentConfig[] = [];
  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const { frontmatter, body } =
      parseFrontmatter<Record<string, string>>(content);
    if (!frontmatter.name || !frontmatter.description) continue;
    const tools = frontmatter.tools
      ?.split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: frontmatter.model,
      systemPrompt: body,
      source,
    });
  }
  return agents;
}

function discoverAgents(cwd: string): AgentConfig[] {
  const userDir = path.join(getAgentDir(), "agents");
  const projectDir = findProjectAgentsDir(cwd);
  const agentMap = new Map<string, AgentConfig>();
  for (const a of loadAgentsFromDir(userDir, "user")) agentMap.set(a.name, a);
  if (projectDir) {
    for (const a of loadAgentsFromDir(projectDir, "project"))
      agentMap.set(a.name, a);
  }
  return Array.from(agentMap.values());
}

function findProjectAgentsDir(cwd: string): string | null {
  let dir = cwd;
  while (true) {
    const candidate = path.join(dir, ".pi", "agents");
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      /* not found */
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function getPiInvocation(args: string[]): {
  command: string;
  args: string[];
} {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }
  return { command: "pi", args };
}

const SubagentParams = Type.Object({
  agent: Type.String({ description: "Name of the agent to invoke" }),
  task: Type.String({ description: "Task to delegate to the agent" }),
});

type SubagentInput = Static<typeof SubagentParams>;

export function createSubagentTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate a task to a specialized subagent with an isolated context window. The subagent runs as a separate process and returns its output. Use this for focused tasks like scanning the todo list for relevant questions.",
    parameters: SubagentParams,

    async execute(_toolCallId, params: SubagentInput, signal) {
      const agents = discoverAgents(process.cwd());
      const agent = agents.find((a) => a.name === params.agent);

      if (!agent) {
        const available =
          agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown agent: "${params.agent}". Available: ${available}`,
            },
          ],
          details: undefined,
          isError: true,
        };
      }

      const args: string[] = ["--mode", "json", "-p", "--no-session"];
      if (agent.model) args.push("--model", agent.model);
      if (agent.tools && agent.tools.length > 0)
        args.push("--tools", agent.tools.join(","));

      let tmpDir: string | null = null;
      let tmpFile: string | null = null;

      try {
        if (agent.systemPrompt.trim()) {
          tmpDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "mne-subagent-"),
          );
          tmpFile = path.join(
            tmpDir,
            `prompt-${agent.name.replace(/[^\w.-]+/g, "_")}.md`,
          );
          await withFileMutationQueue(tmpFile, async () => {
            await fs.promises.writeFile(tmpFile!, agent.systemPrompt, {
              encoding: "utf-8",
              mode: 0o600,
            });
          });
          args.push("--append-system-prompt", tmpFile);
        }

        args.push(`Task: ${params.task}`);

        const output = await runSubagent(args, process.cwd(), signal);
        return {
          content: [{ type: "text" as const, text: output || "(no output)" }],
          details: undefined,
        };
      } finally {
        if (tmpFile)
          try {
            fs.unlinkSync(tmpFile);
          } catch {
            /* ignore */
          }
        if (tmpDir)
          try {
            fs.rmdirSync(tmpDir);
          } catch {
            /* ignore */
          }
      }
    },
  });
}

interface PiMessage {
  role: string;
  content: Array<{ type: string; text?: string }>;
}

function runSubagent(
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";
    const messages: PiMessage[] = [];
    let stderr = "";

    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);
        if (event.type === "message_end" && event.message) {
          messages.push(event.message);
        }
        if (event.type === "tool_result_end" && event.message) {
          messages.push(event.message);
        }
      } catch {
        // skip non-JSON lines
      }
    };

    proc.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) processLine(line);
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (buffer.trim()) processLine(buffer);

      // Extract final assistant text
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === "assistant") {
          for (const part of msg.content) {
            if (part.type === "text" && part.text) {
              resolve(part.text);
              return;
            }
          }
        }
      }
      resolve(code === 0 ? "(no text output)" : `Error (exit ${code}): ${stderr}`);
    });

    proc.on("error", (err) => {
      resolve(`Failed to spawn subagent: ${err.message}`);
    });

    if (signal) {
      const kill = () => {
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
        }, 5000);
      };
      if (signal.aborted) kill();
      else signal.addEventListener("abort", kill, { once: true });
    }
  });
}
