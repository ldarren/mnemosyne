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
  entityColors: Record<string, { bg: string; border: string }>;
}

const COLOR_POOL = [
  "#f0883e", // orange
  "#58a6ff", // blue
  "#a371f7", // purple
  "#3fb950", // green
  "#f778ba", // pink
  "#79c0ff", // light blue
  "#56d364", // emerald
  "#d29922", // gold
  "#f85149", // red
  "#db61a2", // magenta
  "#bc8cff", // lavender
  "#39d353", // bright green
  "#ffa657", // light orange
  "#d2a8ff", // light purple
  "#7ee787", // mint
  "#ff7b72", // coral
  "#a5d6ff", // sky
  "#f2cc60", // yellow
  "#cea5fb", // violet
  "#9ecbff", // pale blue
  "#ffd33d", // amber
  "#b392f0", // iris
  "#85e89d", // seafoam
  "#ffab70", // peach
];

const FALLBACK_COLOR = "#484f58";

export function assignEntityColors(
  entityTypes: string[],
): Record<string, { bg: string; border: string }> {
  const pool = [...COLOR_POOL];
  const colors: Record<string, { bg: string; border: string }> = {};

  for (const type of entityTypes) {
    const color = pool.length > 0 ? pool.shift()! : FALLBACK_COLOR;
    colors[type] = { bg: color, border: color };
  }

  return colors;
}

export function getEntityType(key: string): string {
  const filename = key.includes("/") ? key.split("/").pop()! : key;
  if (filename === "index") return "index";
  if (filename === "todo") return "todo";
  if (filename === "sources") return "sources";
  if (filename === "schema") return "schema";
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
    meeting: "meeting",
    source: "source",
    epic: "epic",
    sprint: "sprint",
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
  const entityTypes = [...new Set(nodes.map((n) => n.entityType))].sort();
  const entityColors = assignEntityColors(entityTypes);

  return { nodes, edges, projects, entityColors };
}
