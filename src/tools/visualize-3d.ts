import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type, type Static } from "typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { buildGraphData, type GraphData } from "./graph-data.js";

const Visualize3dParams = Type.Object({
  output_path: Type.Optional(
    Type.String({
      description:
        "Output HTML file path relative to project root (default: knowledge-graph-3d.html)",
    }),
  ),
});
type Visualize3dInput = Static<typeof Visualize3dParams>;

export function createVisualize3dTool(projectCwd: string, iweCwd: string) {
  return defineTool({
    name: "iwe_visualize_3d",
    label: "Visualize Knowledge Graph (3D)",
    description:
      "Generate an interactive 3D HTML visualization of the knowledge graph using 3d-force-graph (Three.js/WebGL). Writes an HTML file that can be opened in a browser.",
    promptSnippet:
      "Visualize the knowledge graph as an interactive 3D HTML page",
    parameters: Visualize3dParams,
    async execute(_toolCallId, params: Visualize3dInput) {
      const data = await buildGraphData(iweCwd);

      if (!data) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Knowledge graph is empty — nothing to visualize.",
            },
          ],
          details: undefined,
        };
      }

      const html = generateHtml3d(data);
      const outputPath = resolve(
        projectCwd,
        params.output_path ?? "knowledge-graph-3d.html",
      );
      await writeFile(outputPath, html, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `3D graph visualization written to ${outputPath}\n${data.nodes.length} nodes, ${data.edges.length} edges.\nOpen the file in a browser to view.`,
          },
        ],
        details: undefined,
      };
    },
  });
}

function generateHtml3d(data: GraphData): string {
  const graphNodes = data.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    entityType: n.entityType,
    project: n.project,
    inRefs: n.inRefs,
    outRefs: n.outRefs,
  }));

  const graphLinks = data.edges.map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  const graphJson = JSON.stringify({ nodes: graphNodes, links: graphLinks });
  const colorsJson = JSON.stringify(data.entityColors);
  const projectsJson = JSON.stringify(data.projects);

  const legendItems = Object.entries(data.entityColors)
    .map(
      ([type, c]) =>
        `  <div class="legend-item"><div class="legend-dot" style="background:${c.bg}"></div> ${type.charAt(0).toUpperCase() + type.slice(1)}</div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mnemosyne Knowledge Graph (3D)</title>
<script src="https://cdn.jsdelivr.net/npm/3d-force-graph@1.80.0/dist/3d-force-graph.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
  #graph { width: 100vw; height: 100vh; }

  .panel {
    position: absolute; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; padding: 14px 18px; font-size: 12px; z-index: 10;
  }

  .legend { top: 16px; left: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
  .legend h4 { margin-bottom: 8px; color: #58a6ff; }
  .legend-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .legend-line { width: 24px; height: 0; border-top: 2.5px solid; flex-shrink: 0; }
  .legend-section { margin-top: 10px; padding-top: 8px; border-top: 1px solid #30363d; }

  .title-bar { top: 16px; right: 16px; text-align: right; }
  .title-bar h2 { color: #58a6ff; font-size: 16px; }
  .title-bar p { color: #8b949e; font-size: 12px; margin-top: 4px; }

  .filters { top: 90px; right: 16px; display: flex; flex-direction: column; gap: 8px; }
  .filters h4 { color: #58a6ff; margin-bottom: 4px; }
  .filters label { color: #8b949e; font-size: 11px; }
  .filters .toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .filters input[type="checkbox"] { accent-color: #58a6ff; }
  .filters .separator { margin-top: 4px; padding-top: 6px; border-top: 1px solid #30363d; }

  .node-info {
    bottom: 16px; right: 16px; max-width: 350px; font-size: 13px;
    line-height: 1.5; display: none;
  }
  .node-info h3 { color: #58a6ff; margin-bottom: 4px; font-size: 14px; }
  .node-info .key { color: #8b949e; font-family: monospace; font-size: 11px; }
  .node-info .meta { color: #8b949e; font-size: 11px; margin-top: 6px; }

  .controls { bottom: 16px; left: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
  .controls button {
    background: #21262d; border: 1px solid #30363d; color: #c9d1d9;
    border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;
    transition: background 0.15s;
  }
  .controls button:hover { background: #30363d; }
</style>
</head>
<body>

<div class="panel legend">
  <h4>Entity Types</h4>
${legendItems}
  <div class="legend-section"></div>
  <div class="legend-item"><div class="legend-line" style="border-color:#58a6ff"></div> Parent → Child</div>
  <div class="legend-item"><div class="legend-line" style="border-color:#f78166;border-style:dashed"></div> Cross-reference</div>
</div>

<div class="panel title-bar">
  <h2>Mnemosyne Knowledge Graph (3D)</h2>
  <p>${data.nodes.length} documents &middot; ${data.edges.length} links</p>
</div>

<div class="panel filters">
  <h4>Filter by Project</h4>
${data.projects.map((p) => `  <label class="toggle"><input type="checkbox" checked onchange="toggleProject('${p}', this.checked)"> ${p}</label>`).join("\n")}
  <div class="separator"></div>
  <label class="toggle"><input type="checkbox" checked onchange="toggleCrossRefs(this.checked)"> Cross-references</label>
</div>

<div class="panel controls">
  <button onclick="fitAll()">Fit All</button>
  <button onclick="graph.cameraPosition({x:0,y:0,z:300},null,1000)">Reset Camera</button>
  <button onclick="graph.d3ReheatSimulation()">Re-simulate</button>
</div>

<div class="panel node-info" id="node-info">
  <h3 id="info-title"></h3>
  <div class="key" id="info-key"></div>
  <div class="meta" id="info-meta"></div>
</div>

<div id="graph"></div>

<script>
var rawData = ${graphJson};
var entityColors = ${colorsJson};
var allProjects = ${projectsJson};
var visibleProjects = new Set(allProjects);
var showCrossRefs = true;

function getColor(entityType) {
  var c = entityColors[entityType];
  return c ? c.bg : '#484f58';
}

function getFilteredData() {
  var nodes = rawData.nodes.filter(function(n) { return visibleProjects.has(n.project); });
  var nodeIds = new Set(nodes.map(function(n) { return n.id; }));
  var links = rawData.links.filter(function(l) {
    var src = typeof l.source === 'object' ? l.source.id : l.source;
    var tgt = typeof l.target === 'object' ? l.target.id : l.target;
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) return false;
    if (!showCrossRefs && l.type === 'cross-ref') return false;
    return true;
  });
  return { nodes: nodes, links: links };
}

var graph = ForceGraph3D()(document.getElementById('graph'))
  .backgroundColor('#0d1117')
  .nodeLabel(function(n) { return n.label + ' (' + n.entityType + ')'; })
  .nodeColor(function(n) { return getColor(n.entityType); })
  .nodeVal(function(n) { return n.entityType === 'index' ? 8 : 4; })
  .nodeOpacity(0.9)
  .linkColor(function(l) { return l.type === 'cross-ref' ? '#f78166' : '#58a6ff'; })
  .linkOpacity(0.6)
  .linkWidth(function(l) { return l.type === 'cross-ref' ? 1 : 2; })
  .linkDirectionalArrowLength(4)
  .linkDirectionalArrowRelPos(1)
  .onNodeClick(function(node) {
    document.getElementById('info-title').textContent = node.label;
    document.getElementById('info-key').textContent = node.id;
    document.getElementById('info-meta').textContent = node.entityType + ' \\u00b7 ' + node.project + ' \\u00b7 refs in: ' + node.inRefs + ' out: ' + node.outRefs;
    document.getElementById('node-info').style.display = 'block';
    var dist = 60;
    var pos = { x: node.x + dist, y: node.y + dist, z: node.z + dist };
    graph.cameraPosition(pos, node, 1000);
  })
  .graphData(getFilteredData());

// Constrain zoom to prevent getting lost
var controls = graph.controls();
controls.minDistance = 100;
controls.maxDistance = 700;
controls.enableDamping = true;
controls.dampingFactor = 0.15;
controls.rotateSpeed = 1.2;
controls.zoomSpeed = 2;

function fitAll() {
  graph.zoomToFit(500, 40);
}

function applyFilters() {
  graph.graphData(getFilteredData());
  setTimeout(fitAll, 600);
}

function toggleProject(project, checked) {
  if (checked) visibleProjects.add(project);
  else visibleProjects.delete(project);
  applyFilters();
}

function toggleCrossRefs(checked) {
  showCrossRefs = checked;
  applyFilters();
}

// Fit all on initial load once simulation settles
setTimeout(fitAll, 1500);
<\/script>
</body>
</html>`;
}
