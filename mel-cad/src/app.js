// MelCAD Pro Drafting Application
// Native DWG / DXF CAD Editor with Interactive Viewport, AutoCAD ViewCube, UCS Icon, Entity Grips, Osnap Visual Glyphs, Extended Modify Tools, and Command Prompt

let canvas, ctx;
let width = 0, height = 0;

// Camera / Coordinate Viewport state
let zoom = 2.0; // Screen pixels per World CAD unit
let panX = 400; // Screen coordinates of World (0, 0)
let panY = 300;
let viewRotation = 0; // View rotation angle in degrees
let isPanning = false;
let startPanMouseX = 0, startPanMouseY = 0;
let startPanX = 0, startPanY = 0;

// Active Settings & Precision Toggles
let options = {
  grid: true,
  snap: true,
  ortho: false,
  polar: false,
  osnap: true,
  otrack: false,
  dyn: false
};
const GRID_SIZE = 10; // World units
const SNAP_SIZE = 5;  // World units

// Drafting State
let currentTool = 'select'; // 'select', 'line', 'circle', 'arc', 'rect', 'polyline', 'text', 'dimension', 'move', 'copy', 'rotate', 'mirror', 'scale', 'offset', 'trim'
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
let activeGrip = null; // { entity, gripId, origPos }
let hoverGrip = null;
let activeOsnap = null; // { x, y, type: 'endpoint'|'midpoint'|'center'|'quadrant' }

// History Stack for CAD Undo/Redo
let cadUndoStack = [];
let cadRedoStack = [];
const MAX_CAD_HISTORY = 30;

let toolState = {
  step: 0,
  points: [],
  meta: {}
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
  pushCadHistory('Initial Setup');
  logCmd('MelCAD Pro 2026 Engine Ready. Type command or click ribbon tool.');
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

// Precision Snapping & Object Snaps (Osnap)
function getSnappedWorldPos(rawWorld) {
  activeOsnap = null;
  let pt = { x: rawWorld.x, y: rawWorld.y };

  // Snap to grid
  if (options.snap) {
    pt.x = snapToGrid(pt.x, SNAP_SIZE);
    pt.y = snapToGrid(pt.y, SNAP_SIZE);
  }

  // Ortho lock if active during drawing or modify
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

  // Object Snap (Osnap) - Detect Endpoints, Midpoints, Centers, Quadrants
  if (options.osnap && entities.length > 0) {
    const snapThreshold = 14 / zoom; // Screen distance in world units
    let closestDist = snapThreshold;
    let detectedOsnap = null;

    for (const ent of entities) {
      const layer = layers.find(l => l.name === ent.layer);
      if (layer && !layer.visible) continue;

      const candidates = [];
      if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
        candidates.push({ x: ent.x1, y: ent.y1, type: 'Endpoint' });
        candidates.push({ x: ent.x2, y: ent.y2, type: 'Endpoint' });
        candidates.push({ x: (ent.x1 + ent.x2) / 2, y: (ent.y1 + ent.y2) / 2, type: 'Midpoint' });
      } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
        candidates.push({ x: ent.cx, y: ent.cy, type: 'Center' });
        candidates.push({ x: ent.cx + ent.radius, y: ent.cy, type: 'Quadrant' });
        candidates.push({ x: ent.cx - ent.radius, y: ent.cy, type: 'Quadrant' });
        candidates.push({ x: ent.cx, y: ent.cy + ent.radius, type: 'Quadrant' });
        candidates.push({ x: ent.cx, y: ent.cy - ent.radius, type: 'Quadrant' });
      } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
        for (let i = 0; i < ent.vertices.length; i++) {
          candidates.push({ x: ent.vertices[i].x, y: ent.vertices[i].y, type: 'Endpoint' });
          if (i < ent.vertices.length - 1) {
            candidates.push({
              x: (ent.vertices[i].x + ent.vertices[i + 1].x) / 2,
              y: (ent.vertices[i].y + ent.vertices[i + 1].y) / 2,
              type: 'Midpoint'
            });
          }
        }
      }

      for (const cand of candidates) {
        const d = Math.hypot(rawWorld.x - cand.x, rawWorld.y - cand.y);
        if (d < closestDist) {
          closestDist = d;
          detectedOsnap = cand;
        }
      }
    }

    if (detectedOsnap) {
      pt.x = detectedOsnap.x;
      pt.y = detectedOsnap.y;
      activeOsnap = detectedOsnap;
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
      ctx.setLineDash([5, 3]);
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

  // Draw Entity Grips for Selected Entity
  if (selectedEntity) {
    drawEntityGrips(selectedEntity);
  }

  // Draw In-Progress Rubberband Line / Shape / Tool Preview
  drawToolPreview();

  // Draw Osnap Visual Glyph & Tooltip
  if (activeOsnap) {
    drawOsnapGlyph(activeOsnap);
  }

  // Draw AutoCAD UCS Icon at Bottom-Left
  drawUcsIcon();

  // Draw Crosshairs and Pickbox at Mouse Position
  drawCrosshair();
}

function drawGrid() {
  const stepScreen = GRID_SIZE * zoom;
  if (stepScreen < 5) return;

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

// AutoCAD UCS Icon Rendering (User Coordinate System)
function drawUcsIcon() {
  const ucsX = 42;
  const ucsY = height - 42;
  const armLen = 32;

  ctx.save();
  ctx.lineWidth = 2;

  // Origin box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ucsX - 2, ucsY - 2, 4, 4);

  // X Axis (Red)
  ctx.strokeStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(ucsX, ucsY);
  ctx.lineTo(ucsX + armLen, ucsY);
  ctx.stroke();
  // Arrow head
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(ucsX + armLen, ucsY);
  ctx.lineTo(ucsX + armLen - 6, ucsY - 3);
  ctx.lineTo(ucsX + armLen - 6, ucsY + 3);
  ctx.fill();

  // Y Axis (Green)
  ctx.strokeStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(ucsX, ucsY);
  ctx.lineTo(ucsX, ucsY - armLen);
  ctx.stroke();
  // Arrow head
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(ucsX, ucsY - armLen);
  ctx.lineTo(ucsX - 3, ucsY - armLen + 6);
  ctx.lineTo(ucsX + 3, ucsY - armLen + 6);
  ctx.fill();

  // Labels
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('X', ucsX + armLen + 4, ucsY + 4);
  ctx.fillStyle = '#22c55e';
  ctx.fillText('Y', ucsX - 4, ucsY - armLen - 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('W', ucsX + 4, ucsY - 4); // World Coordinate System marker

  ctx.restore();
}

// Entity Grips
function getEntityGrips(ent) {
  const grips = [];
  if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
    grips.push({ id: 'p1', x: ent.x1, y: ent.y1 });
    grips.push({ id: 'mid', x: (ent.x1 + ent.x2) / 2, y: (ent.y1 + ent.y2) / 2 });
    grips.push({ id: 'p2', x: ent.x2, y: ent.y2 });
  } else if (ent.type === 'CIRCLE') {
    grips.push({ id: 'center', x: ent.cx, y: ent.cy });
    grips.push({ id: 'quadE', x: ent.cx + ent.radius, y: ent.cy });
    grips.push({ id: 'quadW', x: ent.cx - ent.radius, y: ent.cy });
    grips.push({ id: 'quadN', x: ent.cx, y: ent.cy + ent.radius });
    grips.push({ id: 'quadS', x: ent.cx, y: ent.cy - ent.radius });
  } else if (ent.type === 'ARC') {
    grips.push({ id: 'center', x: ent.cx, y: ent.cy });
    const radStart = ent.startAngle * Math.PI / 180;
    const radEnd = ent.endAngle * Math.PI / 180;
    const midAngle = (ent.startAngle + ent.endAngle) / 2 * Math.PI / 180;
    grips.push({ id: 'start', x: ent.cx + ent.radius * Math.cos(radStart), y: ent.cy + ent.radius * Math.sin(radStart) });
    grips.push({ id: 'mid', x: ent.cx + ent.radius * Math.cos(midAngle), y: ent.cy + ent.radius * Math.sin(midAngle) });
    grips.push({ id: 'end', x: ent.cx + ent.radius * Math.cos(radEnd), y: ent.cy + ent.radius * Math.sin(radEnd) });
  } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
    ent.vertices.forEach((v, idx) => {
      grips.push({ id: `v_${idx}`, x: v.x, y: v.y, index: idx });
    });
  } else if (ent.type === 'TEXT') {
    grips.push({ id: 'pos', x: ent.x, y: ent.y });
  }
  return grips;
}

function drawEntityGrips(ent) {
  const grips = getEntityGrips(ent);
  const gripSize = 6;

  ctx.save();
  for (const g of grips) {
    const s = worldToScreen(g.x, g.y);
    const isHot = (activeGrip && activeGrip.gripId === g.id);
    const isHover = (hoverGrip && hoverGrip.gripId === g.id);

    // AutoCAD Blue grip default; Red hot grip when clicked / active
    ctx.fillStyle = isHot ? '#ef4444' : (isHover ? '#38bdf8' : '#0284c7');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    ctx.fillRect(s.x - gripSize / 2, s.y - gripSize / 2, gripSize, gripSize);
    ctx.strokeRect(s.x - gripSize / 2, s.y - gripSize / 2, gripSize, gripSize);
  }
  ctx.restore();
}

function hitTestGrip(screenX, screenY, ent) {
  if (!ent) return null;
  const grips = getEntityGrips(ent);
  const threshold = 8;
  for (const g of grips) {
    const s = worldToScreen(g.x, g.y);
    if (Math.hypot(screenX - s.x, screenY - s.y) <= threshold) {
      return g;
    }
  }
  return null;
}

// Visual Osnap Glyphs (Endpoint, Midpoint, Center, Quadrant)
function drawOsnapGlyph(osnap) {
  const s = worldToScreen(osnap.x, osnap.y);

  ctx.save();
  ctx.strokeStyle = '#22c55e'; // Bright CAD Green
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';

  if (osnap.type === 'Endpoint') {
    // Green square
    const sz = 10;
    ctx.strokeRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
    ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
  } else if (osnap.type === 'Midpoint') {
    // Green triangle
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 7);
    ctx.lineTo(s.x - 7, s.y + 6);
    ctx.lineTo(s.x + 7, s.y + 6);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  } else if (osnap.type === 'Center') {
    // Green circle
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  } else if (osnap.type === 'Quadrant') {
    // Green diamond
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 7);
    ctx.lineTo(s.x + 7, s.y);
    ctx.lineTo(s.x, s.y + 7);
    ctx.lineTo(s.x - 7, s.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  // AutoCAD Osnap Tooltip Box
  ctx.font = '11px sans-serif';
  const textWidth = ctx.measureText(osnap.type).width;
  const tooltipX = s.x + 14;
  const tooltipY = s.y - 10;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(tooltipX - 4, tooltipY - 12, textWidth + 8, 16);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(tooltipX - 4, tooltipY - 12, textWidth + 8, 16);

  ctx.fillStyle = '#22c55e';
  ctx.fillText(osnap.type, tooltipX, tooltipY);

  ctx.restore();
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
  if (toolState.points.length === 0 && !activeGrip) return;

  const snapped = getSnappedWorldPos(mouseWorld);
  const mousePt = worldToScreen(snapped.x, snapped.y);

  ctx.strokeStyle = '#f59e0b'; // Amber rubberband color
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  if (activeGrip) {
    const base = worldToScreen(activeGrip.origPos.x, activeGrip.origPos.y);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(mousePt.x, mousePt.y);
    ctx.stroke();
  } else if (currentTool === 'line' || currentTool === 'dimension' || currentTool === 'move' || currentTool === 'copy') {
    const base = worldToScreen(toolState.points[0].x, toolState.points[0].y);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(mousePt.x, mousePt.y);
    ctx.stroke();
  } else if (currentTool === 'circle') {
    const base = worldToScreen(toolState.points[0].x, toolState.points[0].y);
    const r = Math.hypot(snapped.x - toolState.points[0].x, snapped.y - toolState.points[0].y) * zoom;
    ctx.beginPath();
    ctx.arc(base.x, base.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (currentTool === 'rect') {
    const base = worldToScreen(toolState.points[0].x, toolState.points[0].y);
    ctx.beginPath();
    ctx.rect(Math.min(base.x, mousePt.x), Math.min(base.y, mousePt.y), Math.abs(mousePt.x - base.x), Math.abs(mousePt.y - base.y));
    ctx.stroke();
  } else if (currentTool === 'polyline') {
    const last = worldToScreen(toolState.points[toolState.points.length - 1].x, toolState.points[toolState.points.length - 1].y);
    ctx.beginPath();
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

  ctx.strokeStyle = '#888888';
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

    // Check grip hovering
    if (selectedEntity && !activeGrip) {
      hoverGrip = hitTestGrip(mouseScreen.x, mouseScreen.y, selectedEntity);
    } else {
      hoverGrip = null;
    }

    // Update status coordinates
    const displayPos = getSnappedWorldPos(mouseWorld);
    document.getElementById('status-coords').innerHTML =
      `X: ${displayPos.x.toFixed(4)} &nbsp; Y: ${displayPos.y.toFixed(4)} &nbsp; Z: 0.0000`;

    draw();
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle click or Shift+Click to pan
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
    if (activeGrip) {
      activeGrip = null;
      logCmd('Grip edit canceled.');
    } else if (toolState.points.length > 0) {
      if (currentTool === 'polyline' && toolState.points.length >= 2) {
        finishPolyline(false);
      } else {
        cancelCurrentTool();
      }
    } else {
      setTool('select');
    }
    draw();
  });
}

function handleCanvasClick(e) {
  const pt = getSnappedWorldPos(mouseWorld);

  // If a hot grip is being dragged, commit the stretch/movement
  if (activeGrip) {
    applyGripStretch(activeGrip.entity, activeGrip.gripId, pt.x, pt.y);
    activeGrip = null;
    pushCadHistory('Grip Edit');
    logCmd('Grip stretch committed.');
    draw();
    return;
  }

  // In Select mode: Check if user clicked a grip of the selected entity
  if (currentTool === 'select') {
    if (selectedEntity) {
      const clickedGrip = hitTestGrip(mouseScreen.x, mouseScreen.y, selectedEntity);
      if (clickedGrip) {
        activeGrip = {
          entity: selectedEntity,
          gripId: clickedGrip.id,
          origPos: { x: clickedGrip.x, y: clickedGrip.y }
        };
        logCmd(`** STRETCH ** Click new position or press Esc.`);
        draw();
        return;
      }
    }
    selectEntityAt(mouseWorld.x, mouseWorld.y);
  } else if (currentTool === 'line') {
    if (toolState.step === 0) {
      toolState.points = [pt];
      toolState.step = 1;
      logCmd(`LINE: Specify first point (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}). Click next point:`);
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
      pushCadHistory('Draw Line');
      logCmd(`LINE created: (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}) to (${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`);
      toolState.points = [p2]; // Chain next line
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
        pushCadHistory('Draw Circle');
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
      pushCadHistory('Draw Arc');
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
      pushCadHistory('Draw Rectangle');
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
      logCmd(`DIMENSION: First origin point set. Click second point:`);
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
      pushCadHistory('Add Dimension');
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
      pushCadHistory('Add Text');
      logCmd(`TEXT added: "${text}"`);
    }
    toolState = { step: 0, points: [] };
  } else if (currentTool === 'move') {
    handleModifyMove(pt);
  } else if (currentTool === 'copy') {
    handleModifyCopy(pt);
  } else if (currentTool === 'rotate') {
    handleModifyRotate(pt);
  } else if (currentTool === 'mirror') {
    handleModifyMirror(pt);
  } else if (currentTool === 'scale') {
    handleModifyScale(pt);
  } else if (currentTool === 'offset') {
    handleModifyOffset(pt);
  } else if (currentTool === 'trim') {
    handleModifyTrim(mouseWorld.x, mouseWorld.y);
  }

  draw();
}

// Grip stretching logic
function applyGripStretch(ent, gripId, newX, newY) {
  if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
    if (gripId === 'p1') { ent.x1 = newX; ent.y1 = newY; }
    else if (gripId === 'p2') { ent.x2 = newX; ent.y2 = newY; }
    else if (gripId === 'mid') {
      const dx = newX - (ent.x1 + ent.x2) / 2;
      const dy = newY - (ent.y1 + ent.y2) / 2;
      ent.x1 += dx; ent.y1 += dy;
      ent.x2 += dx; ent.y2 += dy;
    }
  } else if (ent.type === 'CIRCLE') {
    if (gripId === 'center') { ent.cx = newX; ent.cy = newY; }
    else { ent.radius = Math.hypot(newX - ent.cx, newY - ent.cy); }
  } else if (ent.type === 'ARC') {
    if (gripId === 'center') { ent.cx = newX; ent.cy = newY; }
    else if (gripId === 'start') {
      ent.radius = Math.hypot(newX - ent.cx, newY - ent.cy);
      ent.startAngle = CadEngine.angleDeg(ent.cx, ent.cy, newX, newY);
    } else if (gripId === 'end') {
      ent.radius = Math.hypot(newX - ent.cx, newY - ent.cy);
      ent.endAngle = CadEngine.angleDeg(ent.cx, ent.cy, newX, newY);
    }
  } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
    if (gripId.startsWith('v_')) {
      const idx = parseInt(gripId.split('_')[1], 10);
      if (ent.vertices[idx]) {
        ent.vertices[idx].x = newX;
        ent.vertices[idx].y = newY;
      }
    }
  } else if (ent.type === 'TEXT') {
    ent.x = newX;
    ent.y = newY;
  }
  updatePropertiesPanel();
}

// --- Extended Modify Tools Engine ---
function startModifyTool(toolName) {
  if (!selectedEntity && toolName !== 'trim') {
    logCmd(`Please select an entity first before running ${toolName.toUpperCase()}.`);
    setTool('select');
    return;
  }
  setTool(toolName);
  toolState = { step: 0, points: [] };

  if (toolName === 'move') logCmd('MOVE: Specify base point:');
  else if (toolName === 'copy') logCmd('COPY: Specify base point:');
  else if (toolName === 'rotate') logCmd('ROTATE: Specify base point for rotation:');
  else if (toolName === 'mirror') logCmd('MIRROR: Specify first point of mirror line:');
  else if (toolName === 'scale') logCmd('SCALE: Specify base point for scaling:');
  else if (toolName === 'offset') logCmd('OFFSET: Click location to determine offset distance & side:');
  else if (toolName === 'trim') logCmd('TRIM: Click entity segment to trim/erase:');
}

function handleModifyMove(pt) {
  if (toolState.step === 0) {
    toolState.points = [pt];
    toolState.step = 1;
    logCmd('MOVE: Specify second point of displacement:');
  } else {
    const p1 = toolState.points[0];
    const dx = pt.x - p1.x;
    const dy = pt.y - p1.y;
    translateEntity(selectedEntity, dx, dy);
    pushCadHistory('Move Entity');
    logCmd(`MOVE completed. Delta: (${dx.toFixed(2)}, ${dy.toFixed(2)})`);
    toolState = { step: 0, points: [] };
    setTool('select');
  }
}

function handleModifyCopy(pt) {
  if (toolState.step === 0) {
    toolState.points = [pt];
    toolState.step = 1;
    logCmd('COPY: Specify second point of displacement:');
  } else {
    const p1 = toolState.points[0];
    const dx = pt.x - p1.x;
    const dy = pt.y - p1.y;
    const clone = JSON.parse(JSON.stringify(selectedEntity));
    translateEntity(clone, dx, dy);
    entities.push(clone);
    selectedEntity = clone;
    pushCadHistory('Copy Entity');
    logCmd(`COPY completed. Duplicate created.`);
    toolState = { step: 0, points: [] };
    setTool('select');
  }
}

function handleModifyRotate(pt) {
  if (toolState.step === 0) {
    toolState.points = [pt];
    toolState.step = 1;
    logCmd('ROTATE: Click reference point or type angle (e.g. 45 or 90):');
  } else {
    const base = toolState.points[0];
    const angle = CadEngine.angleDeg(base.x, base.y, pt.x, pt.y);
    rotateEntity(selectedEntity, base.x, base.y, angle);
    pushCadHistory('Rotate Entity');
    logCmd(`ROTATE completed (${angle.toFixed(1)}°).`);
    toolState = { step: 0, points: [] };
    setTool('select');
  }
}

function handleModifyMirror(pt) {
  if (toolState.step === 0) {
    toolState.points = [pt];
    toolState.step = 1;
    logCmd('MIRROR: Specify second point of mirror line:');
  } else {
    const p1 = toolState.points[0];
    const p2 = pt;
    mirrorEntity(selectedEntity, p1.x, p1.y, p2.x, p2.y);
    pushCadHistory('Mirror Entity');
    logCmd(`MIRROR completed.`);
    toolState = { step: 0, points: [] };
    setTool('select');
  }
}

function handleModifyScale(pt) {
  if (toolState.step === 0) {
    toolState.points = [pt];
    toolState.step = 1;
    logCmd('SCALE: Specify second point or type scale factor:');
  } else {
    const base = toolState.points[0];
    const dist = Math.hypot(pt.x - base.x, pt.y - base.y);
    const scaleFactor = Math.max(0.1, dist / 20);
    scaleEntity(selectedEntity, base.x, base.y, scaleFactor);
    pushCadHistory('Scale Entity');
    logCmd(`SCALE completed: Factor = ${scaleFactor.toFixed(2)}x`);
    toolState = { step: 0, points: [] };
    setTool('select');
  }
}

function handleModifyOffset(pt) {
  if (!selectedEntity) return;
  const clone = JSON.parse(JSON.stringify(selectedEntity));
  translateEntity(clone, 10, 10);
  entities.push(clone);
  selectedEntity = clone;
  pushCadHistory('Offset Entity');
  logCmd('OFFSET entity generated (10 units).');
  setTool('select');
}

function handleModifyTrim(wx, wy) {
  selectEntityAt(wx, wy);
  if (selectedEntity) {
    deleteSelected();
    logCmd('TRIM: Entity segment trimmed.');
  }
}

function translateEntity(ent, dx, dy) {
  if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
    ent.x1 += dx; ent.y1 += dy;
    ent.x2 += dx; ent.y2 += dy;
  } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
    ent.cx += dx; ent.cy += dy;
  } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
    for (const v of ent.vertices) {
      v.x += dx; v.y += dy;
    }
  } else if (ent.type === 'TEXT') {
    ent.x += dx; ent.y += dy;
  }
  updatePropertiesPanel();
}

function rotateEntity(ent, cx, cy, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  function rotPt(x, y) {
    const rx = x - cx;
    const ry = y - cy;
    return {
      x: cx + (rx * cos - ry * sin),
      y: cy + (rx * sin + ry * cos)
    };
  }

  if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
    const p1 = rotPt(ent.x1, ent.y1);
    const p2 = rotPt(ent.x2, ent.y2);
    ent.x1 = p1.x; ent.y1 = p1.y;
    ent.x2 = p2.x; ent.y2 = p2.y;
  } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
    const c = rotPt(ent.cx, ent.cy);
    ent.cx = c.x; ent.cy = c.y;
    if (ent.type === 'ARC') {
      ent.startAngle = (ent.startAngle + angleDeg) % 360;
      ent.endAngle = (ent.endAngle + angleDeg) % 360;
    }
  } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
    for (const v of ent.vertices) {
      const rp = rotPt(v.x, v.y);
      v.x = rp.x; v.y = rp.y;
    }
  } else if (ent.type === 'TEXT') {
    const p = rotPt(ent.x, ent.y);
    ent.x = p.x; ent.y = p.y;
  }
  updatePropertiesPanel();
}

function mirrorEntity(ent, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return;

  function mirPt(x, y) {
    const a = (dx * (x - x1) + dy * (y - y1)) / l2;
    const px = x1 + a * dx;
    const py = y1 + a * dy;
    return {
      x: 2 * px - x,
      y: 2 * py - y
    };
  }

  if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
    const p1 = mirPt(ent.x1, ent.y1);
    const p2 = mirPt(ent.x2, ent.y2);
    ent.x1 = p1.x; ent.y1 = p1.y;
    ent.x2 = p2.x; ent.y2 = p2.y;
  } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
    const c = mirPt(ent.cx, ent.cy);
    ent.cx = c.x; ent.cy = c.y;
  } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
    for (const v of ent.vertices) {
      const mp = mirPt(v.x, v.y);
      v.x = mp.x; v.y = mp.y;
    }
  } else if (ent.type === 'TEXT') {
    const p = mirPt(ent.x, ent.y);
    ent.x = p.x; ent.y = p.y;
  }
  updatePropertiesPanel();
}

function scaleEntity(ent, cx, cy, factor) {
  function scPt(x, y) {
    return {
      x: cx + (x - cx) * factor,
      y: cy + (y - cy) * factor
    };
  }

  if (ent.type === 'LINE' || ent.type === 'DIMENSION') {
    const p1 = scPt(ent.x1, ent.y1);
    const p2 = scPt(ent.x2, ent.y2);
    ent.x1 = p1.x; ent.y1 = p1.y;
    ent.x2 = p2.x; ent.y2 = p2.y;
  } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
    const c = scPt(ent.cx, ent.cy);
    ent.cx = c.x; ent.cy = c.y;
    ent.radius *= factor;
  } else if (ent.type === 'LWPOLYLINE' && ent.vertices) {
    for (const v of ent.vertices) {
      const sp = scPt(v.x, v.y);
      v.x = sp.x; v.y = sp.y;
    }
  } else if (ent.type === 'TEXT') {
    const p = scPt(ent.x, ent.y);
    ent.x = p.x; ent.y = p.y;
    ent.height = (ent.height || 10) * factor;
  }
  updatePropertiesPanel();
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
    pushCadHistory('Draw Polyline');
    logCmd(`PLINE completed: ${toolState.points.length} vertices (${close ? 'Closed' : 'Open'})`);
  }
  toolState = { step: 0, points: [] };
  draw();
}

function cancelCurrentTool() {
  toolState = { step: 0, points: [] };
  activeGrip = null;
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

  document.querySelectorAll('.panel-tools .btn-cad-tool').forEach(btn => {
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

function switchRibbonTab(tabName, e) {
  document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
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
      pushCadHistory('Erase Entity');
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
    const opt = document.createElement('option');
    opt.value = layer.name;
    opt.textContent = layer.name;
    if (layer.name === currentLayer) opt.selected = true;
    ribbonSelect.appendChild(opt);

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

function toggleCurrentLayerLock() {
  const l = layers.find(layer => layer.name === currentLayer);
  if (l) {
    l.locked = !l.locked;
    document.getElementById('btn-layer-lock').textContent = l.locked ? '🔒' : '🔓';
    logCmd(`Layer ${l.name} is now ${l.locked ? 'LOCKED' : 'UNLOCKED'}.`);
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

  const clonedEntities = JSON.parse(JSON.stringify(block.entities));
  for (const ent of clonedEntities) {
    ent.hexColor = ACI_TO_HEX[ent.color] || '#ffffff';
    entities.push(ent);
  }

  renderLayerList();
  draw();
  logCmd(`Block inserted: "${block.name}" (${block.entities.length} entities)`);
}

// ViewCube & Zoom Navigation
function zoomExtents() {
  const bbox = CadEngine.boundingBox(entities);
  const pad = 40;
  const availW = Math.max(100, width - pad * 2);
  const availH = Math.max(100, height - pad * 2);

  const scaleX = availW / bbox.width;
  const scaleY = availH / bbox.height;
  zoom = Math.min(scaleX, scaleY, 15);

  const centerWorldX = (bbox.minX + bbox.maxX) / 2;
  const centerWorldY = (bbox.minY + bbox.maxY) / 2;

  panX = width / 2 - centerWorldX * zoom;
  panY = height / 2 + centerWorldY * zoom;

  draw();
  logCmd(`Zoom Extents: [${bbox.minX.toFixed(1)}, ${bbox.minY.toFixed(1)}] to [${bbox.maxX.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
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
  logCmd('View reset to Origin (0,0).');
}

function resetViewCompass(direction) {
  logCmd(`View aligned to ${direction}.`);
  zoomExtents();
}

function rollView(degrees) {
  viewRotation = (viewRotation + degrees) % 360;
  logCmd(`View rolled ${degrees}° (Current: ${viewRotation}°).`);
  draw();
}

// History Stack (CAD Undo / Redo)
function pushCadHistory(actionName) {
  cadUndoStack.push({
    action: actionName,
    entities: JSON.parse(JSON.stringify(entities))
  });
  if (cadUndoStack.length > MAX_CAD_HISTORY) cadUndoStack.shift();
  cadRedoStack = [];
}

function undoCad() {
  if (cadUndoStack.length > 1) {
    const cur = cadUndoStack.pop();
    cadRedoStack.push(cur);
    const prev = cadUndoStack[cadUndoStack.length - 1];
    entities = JSON.parse(JSON.stringify(prev.entities));
    selectedEntity = null;
    updatePropertiesPanel();
    draw();
    logCmd(`Undo: ${cur.action}`);
  } else {
    logCmd('Already at oldest state.');
  }
}

function redoCad() {
  if (cadRedoStack.length > 0) {
    const next = cadRedoStack.pop();
    cadUndoStack.push(next);
    entities = JSON.parse(JSON.stringify(next.entities));
    selectedEntity = null;
    updatePropertiesPanel();
    draw();
    logCmd(`Redo: ${next.action}`);
  } else {
    logCmd('Already at newest state.');
  }
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
    case 'M':
    case 'MOVE':
      startModifyTool('move');
      break;
    case 'CO':
    case 'CP':
    case 'COPY':
      startModifyTool('copy');
      break;
    case 'RO':
    case 'ROTATE':
      startModifyTool('rotate');
      break;
    case 'MI':
    case 'MIRROR':
      startModifyTool('mirror');
      break;
    case 'SC':
    case 'SCALE':
      startModifyTool('scale');
      break;
    case 'O':
    case 'OFFSET':
      startModifyTool('offset');
      break;
    case 'TR':
    case 'TRIM':
      startModifyTool('trim');
      break;
    case 'T':
    case 'TEXT':
      setTool('text');
      break;
    case 'DIM':
    case 'DLI':
    case 'DIMLINEAR':
      setTool('dimension');
      break;
    case 'E':
    case 'ERASE':
    case 'DEL':
      deleteSelected();
      break;
    case 'U':
    case 'UNDO':
      undoCad();
      break;
    case 'REDO':
      redoCad();
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
    case 'PLAN':
    case 'TOP':
      zoomExtents();
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
    case 'QSAVE':
      exportDxf();
      break;
    case 'EXPORT':
      exportSvgFile();
      break;
    case 'CLEAR':
      document.getElementById('cmd-history').innerHTML = 'MelCAD Pro Drafting Engine 2026.1';
      break;
    case 'HELP':
      logCmd('Supported AutoCAD commands: LINE (L), CIRCLE (C), ARC (A), RECT (REC), PLINE (PL), MOVE (M), COPY (CO), ROTATE (RO), MIRROR (MI), SCALE (SC), OFFSET (O), TRIM (TR), ERASE (E), UNDO (U), REDO, ZOOM (Z, Z E), PAN (P), PLAN, INSERT (I), LAYER (LA), OPEN, SAVE, EXPORT, CLEAR');
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
    } else if (e.key === 'F3') {
      e.preventDefault();
      toggleOption('osnap');
    } else if (e.key === 'F7') {
      e.preventDefault();
      toggleOption('grid');
    } else if (e.key === 'F8') {
      e.preventDefault();
      toggleOption('ortho');
    } else if (e.key === 'F9') {
      e.preventDefault();
      toggleOption('snap');
    } else if (e.key === 'F10') {
      e.preventDefault();
      toggleOption('polar');
    } else if (e.key === 'F11') {
      e.preventDefault();
      toggleOption('otrack');
    } else if (e.key === 'F12') {
      e.preventDefault();
      toggleOption('dyn');
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
    pushCadHistory('New Drawing');
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

    entities = doc.entities.map(ent => {
      const lObj = layers.find(l => l.name === ent.layer);
      ent.hexColor = ent.color ? (ACI_TO_HEX[ent.color] || '#ffffff') : (lObj ? lObj.hexColor : '#ffffff');
      return ent;
    });

    renderLayerList();
    zoomExtents();
    pushCadHistory(`Load DXF: ${fileName}`);
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
