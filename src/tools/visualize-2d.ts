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
      "Generate an interactive 2D HTML visualization of the knowledge graph with force-directed canvas rendering. Writes an HTML file that can be opened in a browser.",
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
  const graphJson = JSON.stringify({
    nodes: data.nodes,
    edges: data.edges,
  });

  const highContrastColors: Record<string, { bg: string; border: string }> = {
    index: { bg: "#ffffff", border: "#e0e0e0" },
    requirement: { bg: "#ff2d55", border: "#ff5c7c" },
    design: { bg: "#bf5af2", border: "#d48af7" },
    task: { bg: "#30d158", border: "#5cdb7e" },
    system: { bg: "#ff9500", border: "#ffb340" },
    api: { bg: "#00e5ff", border: "#64efff" },
    table: { bg: "#ffd600", border: "#ffe033" },
    adr: { bg: "#ff2d92", border: "#ff6fb0" },
    constraint: { bg: "#ff6d00", border: "#ff8f33" },
    role: { bg: "#76ff03", border: "#a0ff4d" },
    team: { bg: "#e91e63", border: "#f06292" },
    meeting: { bg: "#7c4dff", border: "#a27eff" },
    source: { bg: "#18ffff", border: "#6dffff" },
    epic: { bg: "#ffab00", border: "#ffc233" },
    sprint: { bg: "#c6ff00", border: "#daff4d" },
    user: { bg: "#8d6e63", border: "#a1887f" },
    todo: { bg: "#448aff", border: "#7aafff" },
    sources: { bg: "#64ffda", border: "#99ffe6" },
    schema: { bg: "#ea80fc", border: "#f0a6fd" },
    other: { bg: "#90a4ae", border: "#b0bec5" },
  };

  const mergedColors: Record<string, { bg: string; border: string }> = {};
  for (const [type] of Object.entries(data.entityColors)) {
    mergedColors[type] = highContrastColors[type] || data.entityColors[type];
  }

  const entityColorsJson = JSON.stringify(mergedColors);
  const projectsJson = JSON.stringify(data.projects);

  const legendItems = Object.entries(mergedColors)
    .map(
      ([type, c]) =>
        `<div class="legend-item"><div class="legend-dot" style="background:${c.bg};border-color:${c.border}"></div><span>${type.charAt(0).toUpperCase() + type.slice(1)}</span></div>`,
    )
    .join("\n");

  const projectCheckboxes = data.projects
    .map(
      (p) =>
        `<label class="filter-toggle"><input type="checkbox" checked data-project="${p}"> ${p}</label>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mnemosyne Knowledge Graph</title>
<style>
  :root {
    --bg: #0d1117;
    --bg-alt: #161b22;
    --bg-subtle: #1c2128;
    --border: #30363d;
    --border-light: #21262d;
    --ink: #c9d1d9;
    --ink-secondary: #8b949e;
    --ink-muted: #6e7681;
    --ink-faint: #484f58;
    --accent: #58a6ff;
    --accent-orange: #f78166;
    --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-ui);
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .graph-container {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .graph-canvas-wrap {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  #graph-canvas {
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  #graph-canvas:active { cursor: grabbing; }

  .graph-sidebar {
    width: 260px;
    background: var(--bg-alt);
    border-left: 1px solid var(--border);
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .graph-sidebar h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-secondary);
    font-weight: 700;
  }

  .graph-search {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--ink);
    font-size: 12px;
    font-family: var(--font-ui);
    outline: none;
  }
  .graph-search:focus { border-color: var(--accent); }
  .graph-search::placeholder { color: var(--ink-muted); }

  .stats-row {
    display: flex;
    gap: 16px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .stat-item {
    text-align: center;
    flex: 1;
  }
  .stat-item .value {
    font-size: 24px;
    font-weight: 900;
    color: var(--ink);
    line-height: 1;
  }
  .stat-item .label {
    font-size: 9px;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-top: 4px;
  }

  .filter-section { display: flex; flex-direction: column; gap: 4px; }
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--ink-secondary);
    cursor: pointer;
  }
  .filter-toggle input { accent-color: var(--accent); }

  .legend-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--ink-secondary);
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid;
    flex-shrink: 0;
  }
  .legend-line {
    width: 20px;
    height: 0;
    border-top: 2.5px solid;
    flex-shrink: 0;
  }

  .selected-node-info {
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .selected-node-info h4 {
    font-size: 13px;
    margin-bottom: 6px;
  }
  .selected-node-info .prop {
    font-size: 11px;
    color: var(--ink-secondary);
    padding: 2px 0;
    font-family: var(--font-mono);
  }

  .graph-controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    gap: 4px;
    z-index: 10;
  }
  .graph-controls button {
    width: 32px;
    height: 32px;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--ink);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .graph-controls button:hover {
    background: var(--bg-subtle);
    border-color: var(--accent);
  }
  .ctrl-divider {
    width: 1px;
    background: var(--border);
    margin: 4px 2px;
  }

  .graph-tooltip {
    position: absolute;
    pointer-events: none;
    background: rgba(22, 27, 34, 0.95);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    z-index: 100;
    opacity: 0;
    transition: opacity 0.15s;
    backdrop-filter: blur(8px);
    max-width: 280px;
  }
  .graph-tooltip.visible { opacity: 1; }
  .graph-tooltip .tt-name { font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .graph-tooltip .tt-type { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .graph-tooltip .tt-prop { font-size: 10px; color: var(--ink-secondary); font-family: var(--font-mono); padding: 1px 0; }
  .graph-tooltip .tt-conns { font-size: 10px; color: var(--ink-muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }

  .title-bar {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
  }
  .title-bar h2 { font-size: 14px; color: var(--accent); font-weight: 700; }
  .title-bar p { font-size: 11px; color: var(--ink-muted); margin-top: 2px; }
</style>
</head>
<body>

<div class="graph-container">
  <div class="graph-canvas-wrap">
    <canvas id="graph-canvas"></canvas>
    <div class="title-bar">
      <h2>Mnemosyne Knowledge Graph</h2>
      <p>${data.nodes.length} documents &middot; ${data.edges.length} links</p>
    </div>
    <div class="graph-controls">
      <button title="Zoom In" id="btn-zoom-in">+</button>
      <button title="Zoom Out" id="btn-zoom-out">&minus;</button>
      <div class="ctrl-divider"></div>
      <button title="Recenter" id="btn-recenter">&#8982;</button>
    </div>
    <div class="graph-tooltip" id="graph-tooltip"></div>
  </div>
  <div class="graph-sidebar">
    <input type="text" class="graph-search" id="graph-search" placeholder="Search nodes...">
    <div class="stats-row">
      <div class="stat-item"><div class="value" id="stat-nodes">${data.nodes.length}</div><div class="label">Nodes</div></div>
      <div class="stat-item"><div class="value" id="stat-edges">${data.edges.length}</div><div class="label">Edges</div></div>
    </div>
    <div class="filter-section">
      <h3>Filter by Project</h3>
      ${projectCheckboxes}
    </div>
    <div class="filter-section">
      <h3 style="margin-top:8px">Edge Types</h3>
      <label class="filter-toggle"><input type="checkbox" checked id="toggle-parent-child"> Parent &rarr; Child</label>
      <label class="filter-toggle"><input type="checkbox" checked id="toggle-cross-ref"> Cross-references</label>
    </div>
    <div class="legend-section">
      <h3>Entity Types</h3>
      ${legendItems}
      <div style="margin-top:8px"></div>
      <div class="legend-item"><div class="legend-line" style="border-color:var(--accent)"></div><span>Parent &rarr; Child</span></div>
      <div class="legend-item"><div class="legend-line" style="border-color:var(--accent-orange);border-style:dashed"></div><span>Cross-reference</span></div>
    </div>
    <div id="selected-node-panel"></div>
  </div>
</div>

<script>
var graphData = ${graphJson};
var entityColors = ${entityColorsJson};
var projects = ${projectsJson};

var NODE_SHAPES = {
  index: 'hexagon',
  requirement: 'diamond',
  design: 'circle',
  task: 'square',
  system: 'hexagon',
  api: 'triangle',
  table: 'square',
  adr: 'diamond',
  constraint: 'triangle',
  role: 'circle',
  team: 'hexagon',
  meeting: 'square',
  source: 'triangle',
  epic: 'diamond',
  sprint: 'hexagon',
  user: 'circle',
  todo: 'square',
  sources: 'triangle',
  schema: 'diamond',
  other: 'circle'
};

var sim = {
  nodes: [],
  edges: [],
  running: true,
  canvas: null,
  ctx: null,
  raf: null,
  panX: 0,
  panY: 0,
  zoom: 1,
  dragNode: null,
  mouseX: 0,
  mouseY: 0
};

var filters = {
  projects: new Set(projects),
  showParentChild: true,
  showCrossRef: true
};
var searchTerm = '';
var selectedNode = null;

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}
function debounce(fn, ms) {
  var t;
  return function() {
    var args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}

// Compute cluster centers: each project gets its own region
var clusterCenters = {};
(function() {
  var n = projects.length;
  if (n <= 1) {
    clusterCenters[projects[0] || ''] = { x: 0, y: 0 };
    return;
  }
  var clusterRadius = 180 + n * 30;
  for (var i = 0; i < n; i++) {
    var angle = (2 * Math.PI * i) / n - Math.PI / 2;
    clusterCenters[projects[i]] = {
      x: Math.cos(angle) * clusterRadius,
      y: Math.sin(angle) * clusterRadius
    };
  }
})();

// Staggered spawn state
var spawnQueue = [];
var spawnTimer = null;
var spawnBatchSize = 3;
var spawnInterval = 50;
var allPreparedNodes = [];
var edgeMap = {};

function init() {
  var canvas = document.getElementById('graph-canvas');
  sim.canvas = canvas;
  sim.ctx = canvas.getContext('2d');

  function resize() {
    var r = canvas.parentElement.getBoundingClientRect();
    canvas.width = r.width * window.devicePixelRatio;
    canvas.height = r.height * window.devicePixelRatio;
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    sim.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var cw = canvas.width / window.devicePixelRatio;
  var ch = canvas.height / window.devicePixelRatio;
  sim.panX = cw / 2;
  sim.panY = ch / 2;

  graphData.edges.forEach(function(e) {
    edgeMap[e.source] = (edgeMap[e.source] || 0) + 1;
    edgeMap[e.target] = (edgeMap[e.target] || 0) + 1;
  });

  // Prepare all nodes but don't add them yet
  allPreparedNodes = graphData.nodes.map(function(n) {
    var center = clusterCenters[n.project] || { x: 0, y: 0 };
    var deg = edgeMap[n.id] || 0;
    return {
      id: n.id,
      label: n.label,
      entityType: n.entityType,
      project: n.project,
      type: n.type,
      inRefs: n.inRefs,
      outRefs: n.outRefs,
      x: center.x + (Math.random() - 0.5) * 80,
      y: center.y + (Math.random() - 0.5) * 80,
      vx: 0,
      vy: 0,
      r: Math.max(10, Math.min(24, 10 + deg * 2.5)),
      spawnScale: 0
    };
  });

  // Sort: root nodes first (index pages), then by project for visual grouping
  allPreparedNodes.sort(function(a, b) {
    if (a.type === 'root' && b.type !== 'root') return -1;
    if (b.type === 'root' && a.type !== 'root') return 1;
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    return 0;
  });

  sim.nodes = [];
  sim.edges = graphData.edges.slice();
  spawnQueue = allPreparedNodes.slice();

  setupInteraction(canvas);
  setupControls();
  runSimulation();
  startSpawning();
}

function startSpawning() {
  spawnTimer = setInterval(function() {
    if (spawnQueue.length === 0) {
      clearInterval(spawnTimer);
      spawnTimer = null;
      return;
    }
    var batch = spawnQueue.splice(0, spawnBatchSize);
    batch.forEach(function(node) {
      node.spawnScale = 0.01;
      sim.nodes.push(node);
    });
  }, spawnInterval);
}

function setupInteraction(canvas) {
  var isPanning = false;
  var lastMX = 0, lastMY = 0;
  var didDrag = false;

  function canvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - sim.panX) / sim.zoom,
      y: (e.clientY - rect.top - sim.panY) / sim.zoom
    };
  }
  function findNode(cx, cy) {
    for (var i = sim.nodes.length - 1; i >= 0; i--) {
      var n = sim.nodes[i];
      if (!isNodeVisible(n)) continue;
      var dx = n.x - cx, dy = n.y - cy;
      if (dx * dx + dy * dy < n.r * n.r + 36) return n;
    }
    return null;
  }

  canvas.addEventListener('mousedown', function(e) {
    var c = canvasCoords(e);
    var node = findNode(c.x, c.y);
    didDrag = false;
    if (node) {
      sim.dragNode = node;
    } else {
      isPanning = true;
    }
    lastMX = e.clientX;
    lastMY = e.clientY;
  });

  canvas.addEventListener('mousemove', function(e) {
    var dx = e.clientX - lastMX;
    var dy = e.clientY - lastMY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
    if (sim.dragNode) {
      sim.dragNode.x += dx / sim.zoom;
      sim.dragNode.y += dy / sim.zoom;
      sim.dragNode.vx = 0;
      sim.dragNode.vy = 0;
    } else if (isPanning) {
      sim.panX += dx;
      sim.panY += dy;
    }
    lastMX = e.clientX;
    lastMY = e.clientY;
    sim.mouseX = e.clientX;
    sim.mouseY = e.clientY;

    var c = canvasCoords(e);
    var hoverNode = findNode(c.x, c.y);
    var tooltip = document.getElementById('graph-tooltip');
    if (hoverNode && !sim.dragNode && !isPanning) {
      var conns = sim.edges.filter(function(ed) { return ed.source === hoverNode.id || ed.target === hoverNode.id; }).length;
      var ttHtml = '<div class="tt-name">' + esc(hoverNode.label) + '</div>';
      ttHtml += '<div class="tt-type" style="color:' + getNodeColor(hoverNode) + '">' + esc(hoverNode.entityType) + '</div>';
      ttHtml += '<div class="tt-prop">key: ' + esc(hoverNode.id) + '</div>';
      ttHtml += '<div class="tt-prop">project: ' + esc(hoverNode.project) + '</div>';
      ttHtml += '<div class="tt-prop">refs in: ' + hoverNode.inRefs + ' / out: ' + hoverNode.outRefs + '</div>';
      ttHtml += '<div class="tt-conns">' + conns + ' connection' + (conns !== 1 ? 's' : '') + '</div>';
      tooltip.innerHTML = ttHtml;
      var rect = canvas.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top = (e.clientY - rect.top + 14) + 'px';
      tooltip.classList.add('visible');
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.classList.remove('visible');
      canvas.style.cursor = sim.dragNode || isPanning ? 'grabbing' : 'grab';
    }
  });

  canvas.addEventListener('mouseup', function(e) {
    if (sim.dragNode && !didDrag) {
      selectNode(sim.dragNode);
    }
    if (!sim.dragNode && !isPanning && !didDrag) {
      selectedNode = null;
      var panel = document.getElementById('selected-node-panel');
      if (panel) panel.innerHTML = '';
    }
    sim.dragNode = null;
    isPanning = false;
  });

  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 0.9 : 1.1;
    sim.zoom = Math.max(0.1, Math.min(5, sim.zoom * factor));
  }, { passive: false });

  canvas.addEventListener('dblclick', function(e) {
    var c = canvasCoords(e);
    var node = findNode(c.x, c.y);
    if (node) selectNode(node);
  });
}

function setupControls() {
  document.getElementById('btn-zoom-in').addEventListener('click', function() {
    sim.zoom = Math.max(0.1, Math.min(5, sim.zoom * 1.25));
  });
  document.getElementById('btn-zoom-out').addEventListener('click', function() {
    sim.zoom = Math.max(0.1, Math.min(5, sim.zoom * 0.8));
  });
  document.getElementById('btn-recenter').addEventListener('click', function() {
    sim.zoom = 1;
    var cw = sim.canvas.width / window.devicePixelRatio;
    var ch = sim.canvas.height / window.devicePixelRatio;
    sim.panX = cw / 2;
    sim.panY = ch / 2;
  });

  document.getElementById('graph-search').addEventListener('input', debounce(function() {
    searchTerm = this.value.toLowerCase();
  }, 150));

  document.querySelectorAll('[data-project]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      if (this.checked) filters.projects.add(this.dataset.project);
      else filters.projects.delete(this.dataset.project);
    });
  });

  document.getElementById('toggle-parent-child').addEventListener('change', function() {
    filters.showParentChild = this.checked;
  });
  document.getElementById('toggle-cross-ref').addEventListener('change', function() {
    filters.showCrossRef = this.checked;
  });
}

function isNodeVisible(n) {
  return filters.projects.has(n.project);
}

function isEdgeVisible(e) {
  if (e.type === 'parent-child' && !filters.showParentChild) return false;
  if (e.type === 'cross-ref' && !filters.showCrossRef) return false;
  return true;
}

function getNodeColor(n) {
  var ec = entityColors[n.entityType];
  return ec ? ec.bg : '#484f58';
}

function selectNode(simNode) {
  selectedNode = simNode;
  var panel = document.getElementById('selected-node-panel');
  if (!panel) return;
  var color = getNodeColor(simNode);
  var html = '<div class="selected-node-info">';
  html += '<h4 style="color:' + color + '">' + esc(simNode.label) + '</h4>';
  html += '<div class="prop">key: ' + esc(simNode.id) + '</div>';
  html += '<div class="prop">type: ' + esc(simNode.entityType) + '</div>';
  html += '<div class="prop">project: ' + esc(simNode.project) + '</div>';
  html += '<div class="prop">refs in: ' + simNode.inRefs + ' / out: ' + simNode.outRefs + '</div>';
  var conns = sim.edges.filter(function(e) { return e.source === simNode.id || e.target === simNode.id; }).length;
  html += '<div class="prop">connections: ' + conns + '</div>';
  html += '</div>';
  panel.innerHTML = html;
}

function stepSimulation() {
  var nodes = sim.nodes;
  var edges = sim.edges;
  var nodeCount = nodes.length;
  var damping = 0.65;
  var repulsion = nodeCount > 100 ? 1800 : nodeCount > 50 ? 1200 : 800;
  var attraction = nodeCount > 100 ? 0.002 : 0.004;
  var centerGravity = 0.003;
  var clusterGravity = 0.02;
  var maxVelocity = 5;

  var nodeMap = {};
  nodes.forEach(function(n) { nodeMap[n.id] = n; });

  for (var i = 0; i < nodes.length; i++) {
    if (sim.dragNode === nodes[i]) continue;
    if (!isNodeVisible(nodes[i])) continue;
    var n = nodes[i];

    // Animate spawn scale (0 -> 1)
    if (n.spawnScale < 1) {
      n.spawnScale = Math.min(1, n.spawnScale + 0.06);
    }

    // Only apply full physics once spawned enough
    if (n.spawnScale < 0.3) continue;

    var fx = 0, fy = 0;

    // Repulsion from other nodes
    for (var j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      if (!isNodeVisible(nodes[j])) continue;
      if (nodes[j].spawnScale < 0.3) continue;
      var dx = n.x - nodes[j].x;
      var dy = n.y - nodes[j].y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var force = repulsion / (dist * dist);
      fx += (dx / dist) * force;
      fy += (dy / dist) * force;
    }

    // Pull toward project cluster center (strong)
    var center = clusterCenters[n.project];
    if (center) {
      fx += (center.x - n.x) * clusterGravity;
      fy += (center.y - n.y) * clusterGravity;
    }

    // Mild global center gravity
    fx -= n.x * centerGravity;
    fy -= n.y * centerGravity;

    n.vx = (n.vx + fx) * damping;
    n.vy = (n.vy + fy) * damping;

    // Clamp velocity
    var speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
    if (speed > maxVelocity) {
      n.vx = (n.vx / speed) * maxVelocity;
      n.vy = (n.vy / speed) * maxVelocity;
    }
  }

  // Edge spring forces
  edges.forEach(function(e) {
    if (!isEdgeVisible(e)) return;
    var s = nodeMap[e.source];
    var t = nodeMap[e.target];
    if (!s || !t) return;
    if (!isNodeVisible(s) || !isNodeVisible(t)) return;
    if (s.spawnScale < 0.3 || t.spawnScale < 0.3) return;
    var dx = t.x - s.x;
    var dy = t.y - s.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var targetLen = s.project === t.project ? 130 : 180;
    var f = (dist - targetLen) * attraction;
    var efx = (dx / dist) * f;
    var efy = (dy / dist) * f;
    if (sim.dragNode !== s) { s.vx += efx; s.vy += efy; }
    if (sim.dragNode !== t) { t.vx -= efx; t.vy -= efy; }
  });

  // Apply velocity
  nodes.forEach(function(n) {
    if (sim.dragNode === n) return;
    if (!isNodeVisible(n)) return;
    if (n.spawnScale < 0.3) return;
    n.x += n.vx;
    n.y += n.vy;
  });
}

function runSimulation() {
  if (!sim.running) return;
  stepSimulation();
  renderGraph();
  sim.raf = requestAnimationFrame(runSimulation);
}

function drawNodeShape(ctx, x, y, r, entityType) {
  var shape = NODE_SHAPES[entityType] || 'circle';
  switch (shape) {
    case 'square':
      var s = r * 0.85;
      ctx.beginPath();
      ctx.rect(x - s, y - s, s * 2, s * 2);
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.866, y + r * 0.5);
      ctx.lineTo(x - r * 0.866, y + r * 0.5);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'hexagon':
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i - Math.PI / 2;
        var hx = x + r * Math.cos(angle);
        var hy = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
  }
}

function renderGraph() {
  var ctx = sim.ctx;
  var canvas = sim.canvas;
  if (!ctx || !canvas) return;
  var w = canvas.width / window.devicePixelRatio;
  var h = canvas.height / window.devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  // Background grid
  var gridSize = 24;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (var gx = 0; gx < w; gx += gridSize) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
  }
  for (var gy = 0; gy < h; gy += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(sim.panX, sim.panY);
  ctx.scale(sim.zoom, sim.zoom);

  var nodeMap = {};
  sim.nodes.forEach(function(n) { nodeMap[n.id] = n; });

  var searchActive = searchTerm.length > 0;
  var visibleNodes = sim.nodes.filter(function(n) { return isNodeVisible(n); });
  var totalVisible = visibleNodes.length;
  var isDense = totalVisible > 40;
  var labelZoomThreshold = isDense ? 1.5 : 0.5;
  var edgeLabelZoomThreshold = isDense ? 2.5 : 1.2;
  var selectedId = selectedNode ? selectedNode.id : null;

  // Hover detection
  var hoverNodeId = null;
  if (!sim.dragNode && sim.canvas) {
    var rect = sim.canvas.getBoundingClientRect();
    var hx = (sim.mouseX - rect.left - sim.panX) / sim.zoom;
    var hy = (sim.mouseY - rect.top - sim.panY) / sim.zoom;
    for (var hi = sim.nodes.length - 1; hi >= 0; hi--) {
      var hn = sim.nodes[hi];
      if (!isNodeVisible(hn)) continue;
      var hdx = hn.x - hx, hdy = hn.y - hy;
      if (hdx * hdx + hdy * hdy < hn.r * hn.r + 36) { hoverNodeId = hn.id; break; }
    }
  }
  var focusNodeId = selectedId || hoverNodeId;

  // --- Draw edges ---
  sim.edges.forEach(function(e) {
    if (!isEdgeVisible(e)) return;
    var s = nodeMap[e.source];
    var t = nodeMap[e.target];
    if (!s || !t) return;
    if (!isNodeVisible(s) || !isNodeVisible(t)) return;
    if (s.spawnScale < 0.5 || t.spawnScale < 0.5) return;

    var edgeDimmed = searchActive && !(s.label.toLowerCase().includes(searchTerm) || t.label.toLowerCase().includes(searchTerm));
    var isConnectedToFocus = focusNodeId && (e.source === focusNodeId || e.target === focusNodeId);
    var isFocusActive = focusNodeId !== null;
    var lineWidth = isConnectedToFocus ? 3 : 1.5;

    var dx = t.x - s.x;
    var dy = t.y - s.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var curveOffset = isDense ? 12 : 18;
    var offsetX = -dy / len * curveOffset;
    var offsetY = dx / len * curveOffset;
    var cpx = (s.x + t.x) / 2 + offsetX;
    var cpy = (s.y + t.y) / 2 + offsetY;

    var isCrossRef = e.type === 'cross-ref';
    var edgeColor = isCrossRef ? '#f78166' : '#58a6ff';
    var edgeAlpha;
    if (edgeDimmed) {
      edgeAlpha = 0.06;
    } else if (isFocusActive && isConnectedToFocus) {
      edgeAlpha = 0.7;
    } else if (isFocusActive && !isConnectedToFocus) {
      edgeAlpha = 0.06;
    } else {
      edgeAlpha = isDense ? 0.15 : 0.3;
    }

    var cr = parseInt(edgeColor.slice(1, 3), 16);
    var cg = parseInt(edgeColor.slice(3, 5), 16);
    var cb = parseInt(edgeColor.slice(5, 7), 16);

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.strokeStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + edgeAlpha + ')';
    ctx.lineWidth = lineWidth;
    if (isCrossRef) {
      ctx.setLineDash([6, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow
    if (!isDense || isConnectedToFocus) {
      var arrowAngle = Math.atan2(t.y - cpy, t.x - cpx);
      var arrowLen = 5 + lineWidth;
      ctx.beginPath();
      ctx.moveTo(t.x - t.r * Math.cos(arrowAngle), t.y - t.r * Math.sin(arrowAngle));
      ctx.lineTo(t.x - (t.r + arrowLen) * Math.cos(arrowAngle - 0.3), t.y - (t.r + arrowLen) * Math.sin(arrowAngle - 0.3));
      ctx.lineTo(t.x - (t.r + arrowLen) * Math.cos(arrowAngle + 0.3), t.y - (t.r + arrowLen) * Math.sin(arrowAngle + 0.3));
      ctx.closePath();
      ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (edgeDimmed ? 0.06 : isConnectedToFocus ? 0.6 : 0.2) + ')';
      ctx.fill();
    }

    // Edge label
    var showEdgeLabel = !edgeDimmed && (isConnectedToFocus ? sim.zoom > 0.6 : sim.zoom > edgeLabelZoomThreshold);
    if (showEdgeLabel) {
      var zoomInv = 1 / sim.zoom;
      ctx.save();
      ctx.fillStyle = isConnectedToFocus ? 'rgba(201,209,217,0.9)' : 'rgba(139,148,158,0.7)';
      ctx.font = (isConnectedToFocus ? '600 ' : '500 ') + (10 * zoomInv).toFixed(1) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.type, cpx, cpy - (4 * zoomInv));
      ctx.restore();
    }
  });

  // --- Draw nodes ---
  sim.nodes.forEach(function(n) {
    if (!isNodeVisible(n)) return;
    if (n.spawnScale <= 0) return;
    var color = getNodeColor(n);
    var isSelected = selectedId === n.id;
    var isHovered = hoverNodeId === n.id;
    var matchesSearch = !searchActive || n.label.toLowerCase().includes(searchTerm);
    var isFocusFaded = focusNodeId && n.id !== focusNodeId && !sim.edges.some(function(ed) {
      return (ed.source === focusNodeId && ed.target === n.id) ||
             (ed.target === focusNodeId && ed.source === n.id);
    });

    // Ease-out bounce for spawn: overshoot slightly then settle
    var t = n.spawnScale;
    var eased = t < 1 ? (1 - Math.pow(1 - t, 3)) * 1.08 : 1;
    var drawR = n.r * eased;

    var nodeAlpha = !matchesSearch ? 0.12 : (isFocusFaded ? 0.2 : (t < 1 ? t : 1));

    ctx.save();
    ctx.globalAlpha = nodeAlpha;

    // Glow
    if (matchesSearch && !isFocusFaded && (isSelected || isHovered || !searchActive)) {
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 20 : isHovered ? 16 : (isDense ? 4 : 8);
    }

    // Gradient fill
    drawNodeShape(ctx, n.x, n.y, drawR, n.entityType);
    var grad = ctx.createRadialGradient(n.x - drawR * 0.3, n.y - drawR * 0.3, 0, n.x, n.y, drawR * 1.2);
    var pr = parseInt(color.slice(1, 3), 16);
    var pg = parseInt(color.slice(3, 5), 16);
    var pb = parseInt(color.slice(5, 7), 16);
    grad.addColorStop(0, 'rgba(' + Math.min(255, pr + 50) + ',' + Math.min(255, pg + 50) + ',' + Math.min(255, pb + 50) + ',0.95)');
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Selection ring
    if (isSelected) {
      ctx.save();
      drawNodeShape(ctx, n.x, n.y, drawR + 3, n.entityType);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    } else if (isHovered) {
      drawNodeShape(ctx, n.x, n.y, drawR + 2, n.entityType);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (searchActive && matchesSearch) {
      drawNodeShape(ctx, n.x, n.y, drawR, n.entityType);
      ctx.strokeStyle = '#f0f6fc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label (only after fully spawned)
    var showLabel = n.spawnScale >= 0.8 && matchesSearch && !isFocusFaded && (
      isSelected || isHovered ||
      (searchActive && matchesSearch) ||
      (!isDense && sim.zoom > labelZoomThreshold) ||
      (isDense && sim.zoom > labelZoomThreshold && n.r > 12)
    );
    if (showLabel) {
      var zoomInv = 1 / sim.zoom;
      ctx.save();
      ctx.font = (isSelected || isHovered ? '600 ' : '500 ') + (12 * zoomInv).toFixed(1) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';

      var label = truncate(n.label, 20);
      var textW = ctx.measureText(label).width;
      var labelW = textW + (14 * zoomInv);
      var labelH = 18 * zoomInv;
      var labelY = n.y + drawR + (8 * zoomInv);

      ctx.fillStyle = 'rgba(22, 27, 34, 0.92)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(n.x - labelW / 2, labelY, labelW, labelH, 3 * zoomInv);
      else ctx.rect(n.x - labelW / 2, labelY, labelW, labelH);
      ctx.fill();

      ctx.strokeStyle = 'rgba(48, 54, 61, 0.8)';
      ctx.lineWidth = 0.5 * zoomInv;
      ctx.stroke();

      ctx.fillStyle = isSelected || isHovered ? '#f0f6fc' : '#c9d1d9';
      ctx.fillText(label, n.x, labelY + (13 * zoomInv));
      ctx.restore();
    }
  });

  ctx.restore();

  // Empty state
  if (visibleNodes.length === 0) {
    ctx.fillStyle = '#6e7681';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No graph data to display.', w / 2, h / 2);
  }
}

init();
<\/script>
</body>
</html>`;
}
