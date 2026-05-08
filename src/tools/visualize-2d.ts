import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type, type Static } from "typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { buildGraphData, type GraphData } from "./graph-data.js";

const VisualizeParams = Type.Object({
  output_path: Type.Optional(
    Type.String({
      description:
        "Output HTML file path relative to project root (default: knowledge-graph-viewer.html)",
    }),
  ),
});
type VisualizeInput = Static<typeof VisualizeParams>;

export function createVisualize2dTool(projectCwd: string, iweCwd: string) {
  return defineTool({
    name: "iwe_visualize",
    label: "Visualize Knowledge Graph (2D)",
    description:
      "Generate an interactive 2D HTML visualization of the knowledge graph using Cytoscape.js. Writes an HTML file that can be opened in a browser.",
    promptSnippet: "Visualize the knowledge graph as an interactive 2D HTML page",
    parameters: VisualizeParams,
    async execute(_toolCallId, params: VisualizeInput) {
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

      const html = generateHtml(data);
      const outputPath = resolve(
        projectCwd,
        params.output_path ?? "knowledge-graph-viewer.html",
      );
      await writeFile(outputPath, html, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `2D graph visualization written to ${outputPath}\n${data.nodes.length} nodes, ${data.edges.length} edges.\nOpen the file in a browser to view.`,
          },
        ],
        details: undefined,
      };
    },
  });
}

function generateHtml(data: GraphData): string {
  const cyNodes = data.nodes.map((n) => ({ data: n }));
  const cyEdges = data.edges.map((e) => ({ data: e }));
  const graphJson = JSON.stringify({ nodes: cyNodes, edges: cyEdges });

  const projectCheckboxes = data.projects
    .map(
      (p) =>
        `  <label class="toggle"><input type="checkbox" checked onchange="toggleProject('${p}', this.checked)"> ${p}</label>`,
    )
    .join("\n");

  const entityStyleRulesJson = JSON.stringify(data.entityColors);

  const legendItems = Object.entries(data.entityColors)
    .map(
      ([type, c]) =>
        `  <div class="legend-item"><div class="legend-dot" style="background:${c.bg};border:2px solid ${c.border}"></div> ${type.charAt(0).toUpperCase() + type.slice(1)}</div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mnemosyne Knowledge Graph</title>
<script src="https://unpkg.com/cytoscape@3.30.4/dist/cytoscape.min.js"><\/script>
<script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"><\/script>
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
  #cy { width: 100vw; height: 100vh; }

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

  .controls { bottom: 16px; left: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
  .controls button {
    background: #21262d; border: 1px solid #30363d; color: #c9d1d9;
    border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;
    transition: background 0.15s;
  }
  .controls button:hover { background: #30363d; }
  .controls button.active { background: #1f6feb; border-color: #58a6ff; }

  .node-info {
    bottom: 16px; right: 16px; max-width: 350px; font-size: 13px;
    line-height: 1.5; display: none;
  }
  .node-info h3 { color: #58a6ff; margin-bottom: 4px; font-size: 14px; }
  .node-info .key { color: #8b949e; font-family: monospace; font-size: 11px; }
  .node-info .meta { color: #8b949e; font-size: 11px; margin-top: 6px; }

  .faded { opacity: 0.12 !important; transition: opacity 0.2s; }
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
  <h2>Mnemosyne Knowledge Graph</h2>
  <p>${data.nodes.length} documents &middot; ${data.edges.length} links</p>
</div>

<div class="panel filters">
  <h4>Filter by Project</h4>
${projectCheckboxes}
  <div class="separator"></div>
  <label class="toggle"><input type="checkbox" id="toggle-crossrefs" checked onchange="toggleCrossRefs(this.checked)"> Cross-references</label>
</div>

<div class="panel controls">
  <button id="btn-dagre" class="active" onclick="setLayout('dagre')">Hierarchy</button>
  <button id="btn-cose" onclick="setLayout('cose')">Force</button>
  <button id="btn-circle" onclick="setLayout('circle')">Circle</button>
  <button id="btn-grid" onclick="setLayout('grid')">Grid</button>
  <button onclick="cy.fit(undefined, 50)">Fit</button>
</div>

<div class="panel node-info" id="node-info">
  <h3 id="info-title"></h3>
  <div class="key" id="info-key"></div>
  <div class="meta" id="info-meta"></div>
</div>

<div id="cy"></div>

<script>
var graphData = ${graphJson};
var entityColors = ${entityStyleRulesJson};
var allElements = [...graphData.nodes, ...graphData.edges];

var entityStyleRules = Object.keys(entityColors).map(function(t) {
  return {
    selector: 'node[entityType="' + t + '"]',
    style: {
      'background-color': entityColors[t].bg,
      'border-color': entityColors[t].border,
    }
  };
});

var cy = cytoscape({
  container: document.getElementById('cy'),
  elements: allElements,
  style: [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-wrap': 'wrap',
        'text-max-width': '140px',
        'font-size': '11px',
        'text-valign': 'bottom',
        'text-margin-y': 8,
        'color': '#c9d1d9',
        'text-outline-color': '#0d1117',
        'text-outline-width': 2,
        'background-color': '#484f58',
        'border-color': '#6e7681',
        'border-width': 2.5,
        'width': 36,
        'height': 36,
        'transition-property': 'opacity, border-color, border-width, width, height',
        'transition-duration': '0.2s',
      }
    },
    ...entityStyleRules,
    {
      selector: 'node[entityType="index"]',
      style: {
        'width': 48,
        'height': 48,
        'font-size': '13px',
        'font-weight': 'bold',
        'text-max-width': '180px',
      }
    },
    {
      selector: 'node:selected',
      style: {
        'border-color': '#f0f6fc',
        'border-width': 4,
        'overlay-opacity': 0.08,
        'overlay-color': '#58a6ff',
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        'line-color': '#58a6ff',
        'target-arrow-color': '#58a6ff',
        'transition-property': 'opacity',
        'transition-duration': '0.2s',
      }
    },
    {
      selector: 'edge[type="parent-child"]',
      style: {
        'line-color': '#58a6ff',
        'target-arrow-color': '#58a6ff',
        'width': 2.5,
      }
    },
    {
      selector: 'edge[type="cross-ref"]',
      style: {
        'line-color': '#f78166',
        'target-arrow-color': '#f78166',
        'line-style': 'dashed',
        'line-dash-pattern': [6, 3],
        'width': 1.5,
      }
    },
  ],
  layout: { name: 'dagre', rankDir: 'TB', spacingFactor: 1.4, nodeSep: 60, rankSep: 100 },
  wheelSensitivity: 0.3,
  minZoom: 0.1,
  maxZoom: 5,
});

var infoPanel = document.getElementById('node-info');
var infoTitle = document.getElementById('info-title');
var infoKey = document.getElementById('info-key');
var infoMeta = document.getElementById('info-meta');

cy.on('tap', 'node', function(evt) {
  var d = evt.target.data();
  infoTitle.textContent = d.label;
  infoKey.textContent = d.id;
  infoMeta.textContent = d.entityType + ' \\u00b7 ' + d.project + ' \\u00b7 refs in: ' + d.inRefs + ' out: ' + d.outRefs;
  infoPanel.style.display = 'block';
});

cy.on('tap', function(evt) {
  if (evt.target === cy) infoPanel.style.display = 'none';
});

cy.on('mouseover', 'node', function(evt) {
  var hood = evt.target.neighborhood().add(evt.target);
  cy.elements().not(hood).addClass('faded');
});
cy.on('mouseout', 'node', function() {
  cy.elements().removeClass('faded');
});

var layouts = {
  dagre:  { name: 'dagre', rankDir: 'TB', spacingFactor: 1.4, nodeSep: 60, rankSep: 100, animate: true, animationDuration: 400 },
  cose:   { name: 'cose', nodeRepulsion: function(){ return 8000; }, idealEdgeLength: function(){ return 120; }, gravity: 0.25, animate: true, animationDuration: 600 },
  circle: { name: 'circle', spacingFactor: 1.5, animate: true, animationDuration: 400 },
  grid:   { name: 'grid', spacingFactor: 1.8, animate: true, animationDuration: 400 },
};

var currentLayout = 'dagre';

function setLayout(name) {
  currentLayout = name;
  cy.layout(layouts[name]).run();
  document.querySelectorAll('.controls button[id]').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('btn-' + name);
  if (btn) btn.classList.add('active');
}

var visibleProjects = new Set(${JSON.stringify(data.projects)});
var showCrossRefs = true;

function applyFilters() {
  var visibleNodeIds = new Set();
  graphData.nodes.forEach(function(n) {
    if (visibleProjects.has(n.data.project)) {
      visibleNodeIds.add(n.data.id);
    }
  });

  cy.batch(function() {
    cy.nodes().forEach(function(n) {
      if (visibleNodeIds.has(n.id())) { n.style('display', 'element'); }
      else { n.style('display', 'none'); }
    });
    cy.edges().forEach(function(e) {
      var srcVis = visibleNodeIds.has(e.source().id());
      var tgtVis = visibleNodeIds.has(e.target().id());
      var isCrossRef = e.data('type') === 'cross-ref';
      if (srcVis && tgtVis && (!isCrossRef || showCrossRefs)) { e.style('display', 'element'); }
      else { e.style('display', 'none'); }
    });
  });

  cy.layout(layouts[currentLayout]).run();
}

function toggleProject(project, checked) {
  if (checked) { visibleProjects.add(project); }
  else { visibleProjects.delete(project); }
  applyFilters();
}

function toggleCrossRefs(checked) {
  showCrossRefs = checked;
  applyFilters();
}
<\/script>
</body>
</html>`;
}
