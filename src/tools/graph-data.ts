import { execFile } from "node:child_process";

export interface FindResult {
  key: string;
  title: string;
  includes: Array<{ key: string; title: string }>;
  includedBy: Array<{ key: string; title: string }>;
  references: Array<{ key: string; title: string }>;
  referencedBy: Array<{ key: string; title: string }>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  entityType: string;
  project: string;
  inRefs: number;
  outRefs: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  projects: string[];
}

export const ENTITY_COLORS: Record<string, { bg: string; border: string }> = {
  index: { bg: "#f0883e", border: "#f0883e" },
  requirement: { bg: "#58a6ff", border: "#58a6ff" },
  design: { bg: "#a371f7", border: "#a371f7" },
  task: { bg: "#3fb950", border: "#3fb950" },
  system: { bg: "#f778ba", border: "#f778ba" },
  api: { bg: "#79c0ff", border: "#79c0ff" },
  table: { bg: "#56d364", border: "#56d364" },
  adr: { bg: "#d29922", border: "#d29922" },
  constraint: { bg: "#f85149", border: "#f85149" },
  team: { bg: "#db61a2", border: "#db61a2" },
  role: { bg: "#bc8cff", border: "#bc8cff" },
  user: { bg: "#39d353", border: "#39d353" },
  todo: { bg: "#8b949e", border: "#8b949e" },
  other: { bg: "#484f58", border: "#6e7681" },
};

export function getEntityType(key: string): string {
  const filename = key.includes("/") ? key.split("/").pop()! : key;
  if (filename === "index") return "index";
  if (filename === "todo") return "todo";
  const prefix = filename.split("-")[0];
  const typeMap: Record<string, string> = {
    req: "requirement",
    design: "design",
    task: "task",
    sys: "system",
    api: "api",
    table: "table",
    adr: "adr",
    constraint: "constraint",
    role: "role",
    team: "team",
  };
  if (typeMap[prefix]) return typeMap[prefix];
  if (key.startsWith("users/")) return "user";
  return "other";
}

export function getProject(key: string): string {
  if (key.startsWith("users/")) return "users";
  const slash = key.indexOf("/");
  return slash >= 0 ? key.substring(0, slash) : "(root)";
}

export function runIwe(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "iwe",
      args,
      { cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export async function buildGraphData(iweCwd: string): Promise<GraphData | null> {
  const findJson = await runIwe(["find", "-f", "json"], iweCwd);
  const results = JSON.parse(findJson) as FindResult[];

  if (!results || results.length === 0) return null;

  const nodeSet = new Set(results.map((n) => n.key));
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();
  let edgeIdx = 0;

  for (const node of results) {
    for (const parent of node.includedBy ?? []) {
      if (nodeSet.has(parent.key)) {
        const key = `pc:${parent.key}->${node.key}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            id: `e${edgeIdx++}`,
            source: parent.key,
            target: node.key,
            type: "parent-child",
          });
        }
      }
    }

    for (const ref of node.referencedBy ?? []) {
      if (nodeSet.has(ref.key)) {
        const key = `cr:${ref.key}->${node.key}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            id: `e${edgeIdx++}`,
            source: ref.key,
            target: node.key,
            type: "cross-ref",
          });
        }
      }
    }
  }

  const nodes: GraphNode[] = results.map((n) => ({
    id: n.key,
    label: n.title,
    type: n.includedBy.length === 0 ? "root" : "child",
    entityType: getEntityType(n.key),
    project: getProject(n.key),
    inRefs: n.referencedBy.length,
    outRefs: n.references.length,
  }));

  const projects = [...new Set(nodes.map((n) => n.project))].sort();

  return { nodes, edges, projects };
}
