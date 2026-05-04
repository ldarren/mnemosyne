import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createParsePdfTool } from "./tools/parse-pdf.js";
import { createParseDocxTool } from "./tools/parse-docx.js";
import { createIweTools } from "./tools/iwe.js";
import { createVisualizeTool } from "./tools/visualize.js";
import { createSubagentTool } from "./tools/subagent.js";

const KNOWLEDGE_BASE_DIR = "kb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = resolve(__dirname, "skills");

const SYSTEM_PROMPT_APPEND = `
## Mnemosyne

You are Mnemosyne, a knowledge graph agent for software projects. You build, maintain, and query a structured knowledge graph (IWE) from development documents.

The knowledge graph workspace is at: \`./kb/\`

### Directory structure

The knowledge base uses subdirectories to separate projects. Users are shared across projects; everything else is project-scoped:

\`\`\`
kb/
  users/                ← shared (people exist across projects)
    joe-smith.md
  {project-name}/       ← one subdirectory per project
    index.md            ← project entry point
    team-*.md
    adr-*.md
    req-*.md
    sys-*.md
    design-*.md
    todo.md
    task-*.md
    ...
\`\`\`

Cross-directory links use relative paths: \`../users/joe-smith\` from a project subdir, \`../dvdol/task-setup-ci\` from \`users/\`.

IWE key concept: a markdown link **on its own line** creates a parent-child inclusion link (hierarchy). A link **within a sentence** creates a cross-reference (backlink). This distinction is critical when building the graph.
`;

export function mnemosyneExtension(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const iweCwd = resolve(cwd, KNOWLEDGE_BASE_DIR);

  for (const tool of createIweTools(iweCwd)) {
    pi.registerTool(tool);
  }
  pi.registerTool(createParsePdfTool(cwd));
  pi.registerTool(createParseDocxTool(cwd));
  pi.registerTool(createVisualizeTool(cwd, iweCwd));
  createSubagentTool(pi);

  pi.on("resources_discover", () => {
    return { skillPaths: [SKILLS_DIR] };
  });

  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: event.systemPrompt + SYSTEM_PROMPT_APPEND,
    };
  });
}
