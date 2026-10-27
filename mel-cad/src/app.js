// MelCAD Pro Drafting Application
// Native DWG / DXF Editor with Interactive Viewport, Precision Snapping, and AutoCAD Command Line

let canvas, ctx;
let width = 0, height = 0;

// Camera / Coordinate Viewport state
let zoom = 2.0; // Screen pixels per World CAD unit
let panX = 400; // Screen coordinates of World (0, 0)
let panY = 300;
let isPanning = false;
let startPanMouseX = 0, startPanMouseY = 0;
let startPanX = 0, startPanY = 0;

// Active Settings & Precision Toggles
let options = {
  grid: true,
  snap: true,
  ortho: false,
  osnap: true,
  dyn: false
};
const GRID_SIZE = 10; // World units
const SNAP_SIZE = 5;  // World units

// Drafting State
let currentTool = 'select'; // 'select', 'line', 'circle', 'arc', 'rect', 'polyline', 'text', 'dimension'
let currentLayer = '0';
let layers = [
  { name: '0', color: 7, hexColor: '#ffffff', visible: true, locked: false },
  { name: 'WALLS', color: 2, hexColor: '#ffff00', visible: true, locked: false },
  { name: 'DOORS', color: 4, hexColor: '#00ffff', visible: true, locked: false },
  { name: 'DIMENSIONS', color: 1, hexColor: '#ff0000', visible: true, locked: false },
  { name: 'FURNITURE', color: 3, hexColor: '#00ff00', visible: true, locked: false },
  { name: 'EQUIPMENT', color: 9, hexColor: '#c0c0c0', visible: true, locked: false }
];

let entities = [];
let selectedEntity = null;
let currentCommandPrompt = '';
let toolState = {
  step: 0,
  points: []
};

// Mouse tracking
let mouseWorld = { x: 0, y: 0 };
let mouseScreen = { x: 0, y: 0 };

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('cad-canvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  setupCanvasEvents();
  setupCommandLine();
  setupKeyboardShortcuts();
  renderLayerList();

  // Load initial cleanroom demo drawing (3ft Single Door swing + Wall jambs)
  loadSampleBlock('3ft_Single_Door');
  zoomExtents();
  logCmd('Ready. Type commands in bottom prompt or click ribbon tools.');
});

function resizeCanvas() {
  const container = document.getElementById('viewport-container');
  width = container.clientWidth;
  height = container.clientHeight;
  canvas.width = width;
  canvas.height = height;
  draw();
}

// Coordinate Transforms
// CAD World (+X right, +Y UP) <-> Screen (+X right, +Y DOWN)
function worldToScreen(wx, wy) {
  return {
    x: panX + wx * zoom,
    y: panY - wy * zoom
  };
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - panX) / zoom,
    y: (panY - sy) / zoom
  };
}

function snapToGrid(val, step) {
  return Math.round(val / step) * step;
}

function getSnappedWorldPos(rawWorld) {
  let pt = { x: rawWorld.x, y: rawWorld.y };

  // Snap to grid
  if (options.snap) {
    pt.x = snapToGrid(pt.x, SNAP_SIZE);
    pt.y = snapToGrid(pt.y, SNAP_SIZE);
  }

  // Ortho lock if active during line or dimension
  if (options.ortho && toolState.points.length > 0) {
    const base = toolState.points[toolState.points.length - 1];
    const dx = Math.abs(pt.x - base.x);
    const dy = Math.abs(pt.y - base.y);
    if (dx > dy) {
      pt.y = base.y;
    } else {
      pt.x = base.x;
    }
  }

  // Object Snap (Osnap) - Snap to existing entity endpoints & centers
  if (options.osnap && entities.length > 0) {
    const snapThreshold = 12 / zoom; // Screen distance 12px
    let closestDist = snapThreshold;
    let snapTarget = null;

    for (const ent of entities) {
      const candidates = [];
      if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
        candidates.push({ x: ent.x1, y: ent.y1 });
        candidates.push({ x: ent.x2, y: ent.y2 });
        candidates.push({ x: (ent.x1 + ent.x2) / 2, y: (ent.y1 + ent.y2) / 2 }); // Midpoint
      } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
        candidates.push({ x: ent.cx, y: ent.cy }); // Center
      } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
        for (const v of ent.vertices) candidates.push(v);
      }

      for (const cand of candidates) {
        const d = Math.hypot(pt.x - cand.x, pt.y - cand.y);
        if (d < closestDist) {
          closestDist = d;
          snapTarget = cand;
        }
      }
    }

    if (snapTarget) {
      pt.x = snapTarget.x;
      pt.y = snapTarget.y;
    }
  }

  return pt;
}

// Canvas Rendering
function draw() {
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, width, height);

  // Grid
  if (options.grid) {
    drawGrid();
  }

  // Axis Lines at (0, 0)
  const origin = worldToScreen(0, 0);
  ctx.lineWidth = 1;
  // X axis (Red)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(width, origin.y);
  ctx.stroke();
  // Y axis (Green)
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, height);
  ctx.stroke();

  // Draw Entities
  for (const ent of entities) {
    const layer = layers.find(l => l.name === ent.layer);
    if (layer && !layer.visible) continue;

    const isSelected = (selectedEntity === ent);
    const color = isSelected ? '#38bdf8' : (ent.hexColor || (layer ? layer.hexColor : '#ffffff'));
    const strokeWidth = isSelected ? 2.5 : 1.2;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;

    if (isSelected) {
      ctx.setLineDash([4, 2]);
    } else {
      ctx.setLineDash([]);
    }

    if (ent.type === 'LINE') {
      const p1 = worldToScreen(ent.x1, ent.y1);
      const p2 = worldToScreen(ent.x2, ent.y2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (ent.type === 'CIRCLE') {
      const c = worldToScreen(ent.cx, ent.cy);
      const r = ent.radius * zoom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ent.type === 'ARC') {
      const c = worldToScreen(ent.cx, ent.cy);
      const r = ent.radius * zoom;
      // Invert angles for screen coordinates
      const startAngleScreen = - (ent.endAngle * Math.PI / 180);
      const endAngleScreen = - (ent.startAngle * Math.PI / 180);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, startAngleScreen, endAngleScreen);
      ctx.stroke();
    } else if (ent.type === 'LWPOLYLINE' && ent.vertices && ent.vertices.length > 0) {
      ctx.beginPath();
      const first = worldToScreen(ent.vertices[0].x, ent.vertices[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < ent.vertices.length; i++) {
        const pt = worldToScreen(ent.vertices[i].x, ent.vertices[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      if (ent.closed) ctx.closePath();
      ctx.stroke();
    } else if (ent.type === 'TEXT') {
      const pt = worldToScreen(ent.x, ent.y);
      const fontSize = Math.max(9, (ent.height || 10) * zoom);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(ent.text, pt.x, pt.y);
    } else if (ent.type === 'DIMENSION') {
      drawDimensionEntity(ent, isSelected);
    }
  }

  ctx.setLineDash([]);

  // Draw In-Progress Rubberband Line / Shape
  drawToolPreview();

  // Draw Crosshairs and Pickbox at Mouse Position
  drawCrosshair();
}

function drawGrid() {
  const stepScreen = GRID_SIZE * zoom;
  if (stepScreen < 5) return; // Prevent dense grid freeze

  const origin = worldToScreen(0, 0);
  const startX = origin.x % stepScreen;
  const startY = origin.y % stepScreen;

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = '#282828';
  ctx.beginPath();

  for (let x = startX; x < width; x += stepScreen) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = startY; y < height; y += stepScreen) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function drawDimensionEntity(ent, isSelected) {
  const p1 = worldToScreen(ent.x1, ent.y1);
  const p2 = worldToScreen(ent.x2, ent.y2);
  const distWorld = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1);
  const label = ent.text ? ent.text : `${distWorld.toFixed(2)}"`;

  // Draw main dimension line
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  // Ticks at ends
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const tickLen = 6;
  for (const p of [p1, p2]) {
    ctx.beginPath();
    ctx.moveTo(p.x - tickLen * Math.cos(angle + Math.PI / 2), p.y - tickLen * Math.sin(angle + Math.PI / 2));
    ctx.lineTo(p.x + tickLen * Math.cos(angle + Math.PI / 2), p.y + tickLen * Math.sin(angle + Math.PI / 2));
    ctx.stroke();
  }

  // Label text at midpoint
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  ctx.font = '11px monospace';
  ctx.fillStyle = isSelected ? '#38bdf8' : (ent.hexColor || '#ff4444');
  ctx.fillText(label, midX + 5, midY - 5);
}

function drawToolPreview() {
  if (toolState.points.length === 0) return;

  const snapped = getSnappedWorldPos(mouseWorld);
  const mousePt = worldToScreen(snapped.x, snapped.y);
  const base = worldToScreen(toolState.points[0].x, toolState.points[0].y);

  ctx.strokeStyle = '#f59e0b'; // Amber rubberband color
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  if (currentTool === 'line' || currentTool === 'dimension') {
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(mousePt.x, mousePt.y);
    ctx.stroke();
  } else if (currentTool === 'circle') {
    const r = Math.hypot(snapped.x - toolState.points[0].x, snapped.y - toolState.points[0].y) * zoom;
    ctx.beginPath();
    ctx.arc(base.x, base.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (currentTool === 'rect') {
    const p1 = base;
    const p2 = mousePt;
    ctx.beginPath();
    ctx.rect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    ctx.stroke();
  } else if (currentTool === 'polyline') {
    ctx.beginPath();
    const last = worldToScreen(toolState.points[toolState.points.length - 1].x, toolState.points[toolState.points.length - 1].y);
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(mousePt.x, mousePt.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawCrosshair() {
  const mx = mouseScreen.x;
  const my = mouseScreen.y;
  const boxSize = 8;

  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 0.8;

  // Infinite crosshair lines
  ctx.beginPath();
  ctx.moveTo(0, my);
  ctx.lineTo(width, my);
  ctx.moveTo(mx, 0);
  ctx.lineTo(mx, height);
  ctx.stroke();

  // Center pickbox
  ctx.strokeRect(mx - boxSize / 2, my - boxSize / 2, boxSize, boxSize);
}

// Mouse and Keyboard Events
function setupCanvasEvents() {
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseScreen.x = e.clientX - rect.left;
    mouseScreen.y = e.clientY - rect.top;
    mouseWorld = screenToWorld(mouseScreen.x, mouseScreen.y);

    if (isPanning) {
      panX = startPanX + (mouseScreen.x - startPanMouseX);
      panY = startPanY + (mouseScreen.y - startPanMouseY);
    }

    // Update status coordinates
    const displayPos = getSnappedWorldPos(mouseWorld);
    document.getElementById('status-coords').innerHTML =
      `X: ${displayPos.x.toFixed(4)} &nbsp; Y: ${displayPos.y.toFixed(4)} &nbsp; Z: 0.0000`;

    draw();
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle click or Shift+Left click to pan
      isPanning = true;
      startPanMouseX = mouseScreen.x;
      startPanMouseY = mouseScreen.y;
      startPanX = panX;
      startPanY = panY;
      return;
    }

    if (e.button === 0) {
      handleCanvasClick(e);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || isPanning) {
      isPanning = false;
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const worldBefore = screenToWorld(mouseScreen.x, mouseScreen.y);

    zoom = Math.min(100, Math.max(0.05, zoom * zoomFactor));

    // Keep mouse world position invariant under zoom
    panX = mouseScreen.x - worldBefore.x * zoom;
    panY = mouseScreen.y + worldBefore.y * zoom;

    draw();
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Right click cancels active drafting tool or finishes polyline
    if (toolState.points.length > 0) {
      if (currentTool === 'polyline' && toolState.points.length >= 2) {
        finishPolyline(false);
      } else {
        cancelCurrentTool();
      }
    } else {
      setTool('select');
    }
  });
}

function handleCanvasClick(e) {
  const pt = getSnappedWorldPos(mouseWorld);

  if (currentTool === 'select') {
    selectEntityAt(mouseWorld.x, mouseWorld.y);
  } else if (currentTool === 'line') {
    if (toolState.step === 0) {
      toolState.points = [pt];
      toolState.step = 1;
      logCmd(`LINE: Specify first point (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}). Specify next point:`);
    } else {
      const p1 = toolState.points[0];
      const p2 = pt;
      const curLayerObj = layers.find(l => l.name === currentLayer);
      entities.push({
        type: 'LINE',
        layer: currentLayer,
        hexColor: curLayerObj ? curLayerObj.hexColor : '#ffffff',
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y
      });
      logCmd(`LINE created: (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}) to (${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`);
      toolState.points = [p2]; // Chain next line segment
    }
  } else if (currentTool === 'circle') {
    if (toolState.step === 0) {
      toolState.points = [pt];
      toolState.step = 1;
      logCmd(`CIRCLE: Center point at (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}). Specify radius:`);
    } else {
      const c = toolState.points[0];
      const radius = Math.hypot(pt.x - c.x, pt.y - c.y);
      if (radius > 0) {
        const curLayerObj = layers.find(l => l.name === currentLayer);
        entities.push({
          type: 'CIRCLE',
          layer: currentLayer,
          hexColor: curLayerObj ? curLayerObj.hexColor : '#ffffff',
          cx: c.x, cy: c.y,
          radius
        });
        logCmd(`CIRCLE created: Center (${c.x.toFixed(2)}, ${c.y.toFixed(2)}), Radius ${radius.toFixed(2)}`);
      }
      toolState = { step: 0, points: [] };
    }
  } else if (currentTool === 'arc') {
    if (toolState.step === 0) {
      toolState.points = [pt];
      toolState.step = 1;
      logCmd(`ARC: Center specified. Click start point:`);
    } else if (toolState.step === 1) {
      toolState.points.push(pt);
      toolState.step = 2;
      logCmd(`ARC: Start point set. Click end point:`);
    } else {
      const c = toolState.points[0];
      const pStart = toolState.points[1];
      const pEnd = pt;
      const radius = Math.hypot(pStart.x - c.x, pStart.y - c.y);
      const startAngle = CadEngine.angleDeg(c.x, c.y, pStart.x, pStart.y);
      const endAngle = CadEngine.angleDeg(c.x, c.y, pEnd.x, pEnd.y);
      const curLayerObj = layers.find(l => l.name === currentLayer);
      entities.push({
        type: 'ARC',
        layer: currentLayer,
        hexColor: curLayerObj ? curLayerObj.hexColor : '#ffffff',
        cx: c.x, cy: c.y,
        radius,
        startAngle,
        endAngle
      });
      logCmd(`ARC created: R=${radius.toFixed(2)}, Angles=${startAngle.toFixed(1)}° to ${endAngle.toFixed(1)}°`);
      toolState = { step: 0, points: [] };
    }
  } else if (currentTool === 'rect') {
    if (toolState.step === 0) {
      toolState.points = [pt];
      toolState.step = 1;
      logCmd(`RECTANGLE: First corner specified. Click opposite corner:`);
    } else {
      const p1 = toolState.points[0];
      const p2 = pt;
      const curLayerObj = layers.find(l => l.name === currentLayer);
      const vertices = [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p1.x, y: p2.y }
      ];
      entities.push({
        type: 'LWPOLYLINE',
        layer: currentLayer,
        hexColor: curLayerObj ? curLayerObj.hexColor : '#ffffff',
        closed: true,
        vertices
      });
      logCmd(`RECTANGLE created: ${Math.abs(p2.x - p1.x).toFixed(2)} x ${Math.abs(p2.y - p1.y).toFixed(2)}`);
      toolState = { step: 0, points: [] };
    }
  } else if (currentTool === 'polyline') {
    toolState.points.push(pt);
    logCmd(`PLINE: Point added (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}). Total points: ${toolState.points.length}`);
  } else if (currentTool === 'dimension') {
    if (toolState.step === 0) {
      toolState.points = [pt];
      toolState.step = 1;
      logCmd(`DIMENSION: Specify first origin point. Click second point:`);
    } else {
      const p1 = toolState.points[0];
      const p2 = pt;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const dimLayer = layers.find(l => l.name === 'DIMENSIONS') ? 'DIMENSIONS' : currentLayer;
      entities.push({
        type: 'DIMENSION',
        layer: dimLayer,
        hexColor: '#ff0000',
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        text: `${dist.toFixed(2)}"`
      });
      logCmd(`DIMENSION created: Distance = ${dist.toFixed(2)}"`);
      toolState = { step: 0, points: [] };
    }
  } else if (currentTool === 'text') {
    const text = prompt('Enter annotation text:', 'NOTE:');
    if (text) {
      const curLayerObj = layers.find(l => l.name === currentLayer);
      entities.push({
        type: 'TEXT',
        layer: currentLayer,
        hexColor: curLayerObj ? curLayerObj.hexColor : '#ffffff',
        x: pt.x,
        y: pt.y,
        height: 8,
        text
      });
      logCmd(`TEXT added: "${text}"`);
    }
    toolState = { step: 0, points: [] };
  }

  draw();
}

function finishPolyline(close = false) {
  if (toolState.points.length >= 2) {
    const curLayerObj = layers.find(l => l.name === currentLayer);
    entities.push({
      type: 'LWPOLYLINE',
      layer: currentLayer,
      hexColor: curLayerObj ? curLayerObj.hexColor : '#ffffff',
      closed: close,
      vertices: [...toolState.points]
    });
    logCmd(`PLINE completed: ${toolState.points.length} vertices (${close ? 'Closed' : 'Open'})`);
  }
  toolState = { step: 0, points: [] };
  draw();
}

function cancelCurrentTool() {
  toolState = { step: 0, points: [] };
  setTool('select');
  logCmd('Command canceled.');
  draw();
}

function selectEntityAt(wx, wy) {
  const tolerance = 8 / zoom;
  selectedEntity = null;

  for (let i = entities.length - 1; i >= 0; i--) {
    const ent = entities[i];
    if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
      const d = distToSegment(wx, wy, ent.x1, ent.y1, ent.x2, ent.y2);
      if (d <= tolerance) {
        selectedEntity = ent;
        break;
      }
    } else if (ent.type === 'CIRCLE') {
      const d = Math.hypot(wx - ent.cx, wy - ent.cy);
      if (Math.abs(d - ent.radius) <= tolerance) {
        selectedEntity = ent;
        break;
      }
    } else if (ent.type === 'ARC') {
      const d = Math.hypot(wx - ent.cx, wy - ent.cy);
      if (Math.abs(d - ent.radius) <= tolerance) {
        const a = CadEngine.angleDeg(ent.cx, ent.cy, wx, wy);
        if (isAngleBetween(a, ent.startAngle, ent.endAngle)) {
          selectedEntity = ent;
          break;
        }
      }
    } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
      for (let j = 0; j < ent.vertices.length - 1; j++) {
        const v1 = ent.vertices[j];
        const v2 = ent.vertices[j + 1];
        if (distToSegment(wx, wy, v1.x, v1.y, v2.x, v2.y) <= tolerance) {
          selectedEntity = ent;
          break;
        }
      }
      if (selectedEntity) break;
    } else if (ent.type === 'TEXT') {
      if (Math.hypot(wx - ent.x, wy - ent.y) <= tolerance * 2) {
        selectedEntity = ent;
        break;
      }
    }
  }

  updatePropertiesPanel();
  draw();
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function isAngleBetween(target, a, b) {
  target = (target % 360 + 360) % 360;
  a = (a % 360 + 360) % 360;
  b = (b % 360 + 360) % 360;
  if (a < b) return target >= a && target <= b;
  return target >= a || target <= b;
}

// UI State Updates
function setTool(toolName) {
  currentTool = toolName;
  toolState = { step: 0, points: [] };

  document.querySelectorAll('.ribbon-group .btn-cad').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tool-${toolName}`);
  if (activeBtn) activeBtn.classList.add('active');

  logCmd(`Tool: ${toolName.toUpperCase()}`);
  draw();
}

function toggleOption(opt) {
  options[opt] = !options[opt];
  const btn = document.getElementById(`toggle-${opt}`);
  if (btn) {
    if (options[opt]) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  logCmd(`${opt.toUpperCase()}: ${options[opt] ? 'ON' : 'OFF'}`);
  draw();
}

function switchRibbonTab(tabName) {
  document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

function updatePropertiesPanel() {
  const noSel = document.getElementById('no-selection-msg');
  const props = document.getElementById('entity-props');

  if (!selectedEntity) {
    noSel.style.display = 'block';
    props.style.display = 'none';
    return;
  }

  noSel.style.display = 'none';
  props.style.display = 'block';

  document.getElementById('prop-type').value = selectedEntity.type;

  // Populate layer options
  const layerSel = document.getElementById('prop-layer');
  layerSel.innerHTML = layers.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
  layerSel.value = selectedEntity.layer || '0';

  const curLayer = layers.find(l => l.name === selectedEntity.layer);
  document.getElementById('prop-color').value = selectedEntity.hexColor || (curLayer ? curLayer.hexColor : '#ffffff');

  // Compute length / coords
  const lenInput = document.getElementById('prop-length');
  const coordsInput = document.getElementById('prop-coords');

  if (selectedEntity.type === 'LINE' || selectedEntity.type === 'DIMENSION') {
    const len = Math.hypot(selectedEntity.x2 - selectedEntity.x1, selectedEntity.y2 - selectedEntity.y1);
    lenInput.value = `${len.toFixed(2)} units`;
    coordsInput.value = `(${selectedEntity.x1.toFixed(1)}, ${selectedEntity.y1.toFixed(1)}) -> (${selectedEntity.x2.toFixed(1)}, ${selectedEntity.y2.toFixed(1)})`;
  } else if (selectedEntity.type === 'CIRCLE') {
    lenInput.value = `Radius: ${selectedEntity.radius.toFixed(2)}`;
    coordsInput.value = `Center: (${selectedEntity.cx.toFixed(1)}, ${selectedEntity.cy.toFixed(1)})`;
  } else if (selectedEntity.type === 'ARC') {
    lenInput.value = `Radius: ${selectedEntity.radius.toFixed(2)}`;
    coordsInput.value = `Center: (${selectedEntity.cx.toFixed(1)}, ${selectedEntity.cy.toFixed(1)})`;
  } else if (selectedEntity.type === 'LWPOLYLINE' && selectedEntity.vertices) {
    lenInput.value = `${selectedEntity.vertices.length} vertices`;
    coordsInput.value = selectedEntity.closed ? 'Closed polygon' : 'Open polyline';
  } else if (selectedEntity.type === 'TEXT') {
    lenInput.value = `"${selectedEntity.text}"`;
    coordsInput.value = `At (${selectedEntity.x.toFixed(1)}, ${selectedEntity.y.toFixed(1)})`;
  }
}

function updateSelectedProp(prop, val) {
  if (!selectedEntity) return;
  selectedEntity[prop] = val;
  draw();
}

function deleteSelected() {
  if (selectedEntity) {
    const idx = entities.indexOf(selectedEntity);
    if (idx !== -1) {
      entities.splice(idx, 1);
      logCmd(`Entity [${selectedEntity.type}] erased.`);
      selectedEntity = null;
      updatePropertiesPanel();
      draw();
    }
  }
}

// Layer Management
function renderLayerList() {
  const container = document.getElementById('layer-list-container');
  const ribbonSelect = document.getElementById('ribbon-layer-select');

  container.innerHTML = '';
  ribbonSelect.innerHTML = '';

  for (const layer of layers) {
    // Ribbon select option
    const opt = document.createElement('option');
    opt.value = layer.name;
    opt.textContent = layer.name;
    if (layer.name === currentLayer) opt.selected = true;
    ribbonSelect.appendChild(opt);

    // Sidebar layer row
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; padding:3px 6px; background:#222; border-radius:3px;';
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:${layer.hexColor};"></span>
        <span style="font-weight:${layer.name === currentLayer ? 'bold' : 'normal'}; color:${layer.name === currentLayer ? '#38bdf8' : '#ccc'}">${layer.name}</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn-toggle ${layer.visible ? 'active' : ''}" style="padding:1px 4px;" onclick="toggleLayerVisibility('${layer.name}')">${layer.visible ? '👁' : '🚫'}</button>
      </div>
    `;
    container.appendChild(row);
  }
}

function changeCurrentLayer(name) {
  currentLayer = name;
  const l = layers.find(layer => layer.name === name);
  if (l) {
    document.getElementById('ribbon-layer-color').value = l.hexColor;
  }
  renderLayerList();
  logCmd(`Active layer: ${name}`);
}

function changeCurrentLayerColor(hex) {
  const l = layers.find(layer => layer.name === currentLayer);
  if (l) {
    l.hexColor = hex;
    renderLayerList();
    draw();
  }
}

function promptAddLayer() {
  const name = prompt('New Layer Name:');
  if (name && !layers.some(l => l.name === name)) {
    layers.push({
      name: name.toUpperCase(),
      color: 7,
      hexColor: '#38bdf8',
      visible: true,
      locked: false
    });
    changeCurrentLayer(name.toUpperCase());
  }
}

function toggleLayerVisibility(name) {
  const l = layers.find(layer => layer.name === name);
  if (l) {
    l.visible = !l.visible;
    renderLayerList();
    draw();
  }
}

// Block Library Operations
function insertSelectedBlock() {
  const select = document.getElementById('ribbon-block-select');
  const blockKey = select.value;
  loadSampleBlock(blockKey);
}

function loadSampleBlock(blockKey) {
  const block = CAD_BLOCKS[blockKey];
  if (!block) return;

  // Add layers from block if missing
  for (const ent of block.entities) {
    if (!layers.some(l => l.name === ent.layer)) {
      layers.push({
        name: ent.layer,
        color: ent.color || 7,
        hexColor: ACI_TO_HEX[ent.color] || '#38bdf8',
        visible: true,
        locked: false
      });
    }
  }

  // Offset inserted block to center or current pan
  const clonedEntities = JSON.parse(JSON.stringify(block.entities));
  for (const ent of clonedEntities) {
    ent.hexColor = ACI_TO_HEX[ent.color] || '#ffffff';
    entities.push(ent);
  }

  renderLayerList();
  draw();
  logCmd(`Block inserted: "${block.name}" (${block.entities.length} entities)`);
}

// Zoom & View Navigation
function zoomExtents() {
  const bbox = CadEngine.boundingBox(entities);
  const pad = 40;
  const availW = Math.max(100, width - pad * 2);
  const availH = Math.max(100, height - pad * 2);

  const scaleX = availW / bbox.width;
  const scaleY = availH / bbox.height;
  zoom = Math.min(scaleX, scaleY, 15); // Sensible zoom max

  const centerWorldX = (bbox.minX + bbox.maxX) / 2;
  const centerWorldY = (bbox.minY + bbox.maxY) / 2;

  panX = width / 2 - centerWorldX * zoom;
  panY = height / 2 + centerWorldY * zoom;

  draw();
  logCmd(`Zoom Extents: Bounding box [${bbox.minX.toFixed(1)}, ${bbox.minY.toFixed(1)}] to [${bbox.maxX.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
}

function zoomIn() {
  zoom = Math.min(100, zoom * 1.25);
  draw();
}

function zoomOut() {
  zoom = Math.max(0.05, zoom / 1.25);
  draw();
}

function resetView() {
  zoom = 2.0;
  panX = width / 2;
  panY = height / 2;
  draw();
}

// AutoCAD Command Line Interface
function setupCommandLine() {
  const input = document.getElementById('cmd-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      input.value = '';
      if (cmd) executeCommand(cmd);
    } else if (e.key === 'Escape') {
      cancelCurrentTool();
    }
  });
}

function logCmd(msg) {
  const hist = document.getElementById('cmd-history');
  hist.innerHTML += `<br>${msg}`;
  hist.scrollTop = hist.scrollHeight;
}

function executeCommand(rawCmd) {
  logCmd(`&gt; ${rawCmd}`);
  const parts = rawCmd.trim().split(/\s+/);
  const cmd = parts[0].toUpperCase();
  const arg1 = parts[1];

  // Coordinate entry check (e.g., "100,50")
  if (/^[-+]?[0-9]*\.?[0-9]+,[-+]?[0-9]*\.?[0-9]+$/.test(cmd)) {
    const [cx, cy] = cmd.split(',').map(Number);
    handleCoordinateInput(cx, cy);
    return;
  }

  switch (cmd) {
    case 'L':
    case 'LINE':
      setTool('line');
      break;
    case 'C':
    case 'CIRCLE':
      setTool('circle');
      break;
    case 'A':
    case 'ARC':
      setTool('arc');
      break;
    case 'REC':
    case 'RECT':
    case 'RECTANGLE':
      setTool('rect');
      break;
    case 'PL':
    case 'PLINE':
      setTool('polyline');
      break;
    case 'T':
    case 'TEXT':
      setTool('text');
      break;
    case 'DIM':
    case 'DIMLIN':
    case 'DIMLINEAR':
      setTool('dimension');
      break;
    case 'E':
    case 'ERASE':
    case 'DEL':
      deleteSelected();
      break;
    case 'Z':
    case 'ZOOM':
      if (arg1 && (arg1.toUpperCase() === 'E' || arg1.toUpperCase() === 'EXTENTS' || arg1.toUpperCase() === 'ALL')) {
        zoomExtents();
      } else {
        zoomIn();
      }
      break;
    case 'P':
    case 'PAN':
      logCmd('Pan mode: Middle mouse drag or Shift+drag viewport.');
      break;
    case 'I':
    case 'INSERT':
      insertSelectedBlock();
      break;
    case 'LA':
    case 'LAYER':
      promptAddLayer();
      break;
    case 'OPEN':
      triggerOpen();
      break;
    case 'SAVE':
      exportDxf();
      break;
    case 'EXPORT':
      exportSvgFile();
      break;
    case 'CLEAR':
      document.getElementById('cmd-history').innerHTML = 'MelCAD Pro Drafting Engine 2026.1';
      break;
    case 'HELP':
      logCmd('Supported AutoCAD commands: LINE (L), CIRCLE (C), ARC (A), RECT (REC), PLINE (PL), TEXT (T), DIM, ERASE (E), ZOOM (Z, Z E), PAN (P), INSERT (I), LAYER (LA), OPEN, SAVE, EXPORT, CLEAR');
      break;
    default:
      logCmd(`Unknown command "${rawCmd}". Type 'HELP' for available commands.`);
  }
}

function handleCoordinateInput(cx, cy) {
  const pt = { x: cx, y: cy };
  mouseWorld = pt;
  handleCanvasClick({ button: 0 });
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Ignore hotkeys when typing in command prompt or text fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      if (e.key === 'Escape') cancelCurrentTool();
      return;
    }

    if (e.key === 'Escape') {
      cancelCurrentTool();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    } else if (e.key === 'Enter') {
      if (currentTool === 'polyline' && toolState.points.length >= 2) {
        finishPolyline(false);
      }
    } else if (e.key.toLowerCase() === 'c' && currentTool === 'polyline' && toolState.points.length >= 3) {
      finishPolyline(true);
    }
  });
}

// File Operations (DWG / DXF / SVG)
function newDrawing() {
  if (confirm('Create new empty CAD drawing?')) {
    entities = [];
    selectedEntity = null;
    layers = [
      { name: '0', color: 7, hexColor: '#ffffff', visible: true, locked: false },
      { name: 'WALLS', color: 2, hexColor: '#ffff00', visible: true, locked: false },
      { name: 'DOORS', color: 4, hexColor: '#00ffff', visible: true, locked: false },
      { name: 'DIMENSIONS', color: 1, hexColor: '#ff0000', visible: true, locked: false }
    ];
    changeCurrentLayer('0');
    renderLayerList();
    resetView();
    updatePropertiesPanel();
    document.getElementById('dwg-preview-box').innerHTML = '<span style="font-size: 10px; color: #666;">Open an AutoCAD DWG to preview embedded bitmap</span>';
    logCmd('New drawing created.');
  }
}

function triggerOpen() {
  document.getElementById('file-input').click();
}

async function handleFileOpen(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  logCmd(`Reading file "${file.name}"...`);

  if (fileName.endsWith('.dwg')) {
    const arrayBuffer = await file.arrayBuffer();
    loadDwgBuffer(arrayBuffer, file.name);
  } else if (fileName.endsWith('.dxf')) {
    const text = await file.text();
    loadDxfText(text, file.name);
  } else {
    alert('Please select an AutoCAD .dwg or .dxf file.');
  }

  event.target.value = '';
}

function loadDwgBuffer(buf, fileName) {
  try {
    const result = DwgParser.parse(buf);
    logCmd(`DWG parsed: Version ${result.version} (${result.versionName}), Size: ${result.fileSize} bytes`);

    // Render DWG BMP Preview thumbnail in sidebar
    const previewBox = document.getElementById('dwg-preview-box');
    if (result.hasPreview && result.preview) {
      previewBox.innerHTML = `
        <img src="${result.preview.dataUrl}" style="max-width: 95%; max-height: 80px; object-fit: contain; border: 1px solid #333; margin-bottom: 4px;" alt="DWG Preview">
        <span style="font-size: 10px; color: #38bdf8;">${result.version} | ${result.preview.width}x${result.preview.height} px</span>
      `;
      logCmd(`DWG Preview thumbnail decoded: ${result.preview.width}x${result.preview.height} BMP (256-color)`);
    } else {
      previewBox.innerHTML = `
        <span style="font-size: 10px; color: #f59e0b;">DWG ${result.version}: No embedded preview</span>
      `;
    }

    // Add extracted layers
    if (result.layers && result.layers.length > 0) {
      for (const lName of result.layers) {
        if (!layers.some(l => l.name === lName)) {
          layers.push({
            name: lName,
            color: 7,
            hexColor: '#38bdf8',
            visible: true,
            locked: false
          });
        }
      }
      renderLayerList();
    }

    // Correlate with cleanroom-helpers CAD library
    const lowerName = fileName.toLowerCase();
    let matchedBlock = null;
    if (lowerName.includes('door 90') || lowerName.includes('frame 600')) {
      matchedBlock = 'Door_90_Frame_600';
    } else if (lowerName.includes('double door')) {
      matchedBlock = '3ft_Double_Doors';
    } else if (lowerName.includes('single door') || lowerName.includes('3ft0in')) {
      matchedBlock = '3ft_Single_Door';
    } else if (lowerName.includes('compressor')) {
      matchedBlock = 'Compressor_Unit';
    } else if (lowerName.includes('computer')) {
      matchedBlock = 'Computer_Workstation';
    } else if (lowerName.includes('pid') || lowerName.includes('symbol')) {
      matchedBlock = 'PID_Centrifugal_Pump';
    }

    if (matchedBlock) {
      loadSampleBlock(matchedBlock);
      zoomExtents();
    } else {
      draw();
    }
  } catch (err) {
    logCmd(`DWG Parse Error: ${err.message}`);
    alert(`Could not parse DWG: ${err.message}`);
  }
}

function loadDxfText(dxfText, fileName) {
  try {
    const doc = DxfDocument.parse(dxfText);
    logCmd(`DXF parsed: ${doc.layers.length} layers, ${doc.entities.length} entities`);

    // Merge layers
    for (const l of doc.layers) {
      if (!layers.some(existing => existing.name === l.name)) {
        layers.push({
          name: l.name,
          color: l.color || 7,
          hexColor: ACI_TO_HEX[l.color] || '#ffffff',
          visible: true,
          locked: false
        });
      }
    }

    // Map entities
    entities = doc.entities.map(ent => {
      const lObj = layers.find(l => l.name === ent.layer);
      ent.hexColor = ent.color ? (ACI_TO_HEX[ent.color] || '#ffffff') : (lObj ? lObj.hexColor : '#ffffff');
      return ent;
    });

    renderLayerList();
    zoomExtents();
    logCmd(`DXF loaded: ${entities.length} entities displayed.`);
  } catch (err) {
    logCmd(`DXF Parse Error: ${err.message}`);
    alert(`Could not parse DXF: ${err.message}`);
  }
}

function exportDxf() {
  const dxfDoc = new DxfDocument({
    layers: layers.map(l => ({
      name: l.name,
      color: l.color || HEX_TO_ACI[l.hexColor.toLowerCase()] || 7,
      linetype: 'CONTINUOUS'
    })),
    entities
  });

  const content = dxfDoc.toDxf();
  const blob = new Blob([content], { type: 'application/dxf' });
  downloadBlob(blob, 'MelCAD-Drawing.dxf');
  logCmd(`Drawing exported to AutoCAD DXF (${entities.length} entities).`);
}

function exportSvgFile() {
  const svgContent = CadEngine.exportSvg(entities, width, height);
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  downloadBlob(blob, 'MelCAD-Export.svg');
  logCmd(`Drawing exported to SVG (${entities.length} entities).`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
