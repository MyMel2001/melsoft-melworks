// MelDraw Studio Professional Client Engine
// Complete Adobe Photoshop Clone with Free Transform (Ctrl+T), Selection Marquee (M) Marching Ants, Multi-Layer Compositing, and PSD 8BPS Engine

const { PsdDocument } = require('./psd');
const { SubjectSegmenter } = require('./segment');

let docWidth = 800;
let docHeight = 600;

// Documents state (tab strip)
let documents = [{ id: 'Untitled-1', name: 'Untitled-1' }];
let activeDocId = 'Untitled-1';

// Layers state
let layers = [];
let activeLayerIndex = 0;

// History stack
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 25;

// Tool state
let currentTool = 'brush'; // 'move', 'marquee', 'lasso', 'wand', 'crop', 'eyedropper', 'brush', 'pencil', 'stamp', 'eraser', 'bucket', 'gradient', 'blur', 'dodge', 'text', 'rect', 'oval', 'hand'
let brushSize = 15;
let brushOpacity = 1.0;
let brushBlend = 'source-over';
let tolerance = 32;
let fgColor = '#1e293b';
let bgColor = '#ffffff';
let isPainting = false;
let lastX = 0, lastY = 0;
let pickTarget = 'fg';

// Selection (Marquee) State
let activeSelection = null; // { x, y, width, height }
let selectionStart = null;
let marchOffset = 0;
let marqueeMoved = false; // true once marquee drag actually moved
let lastCanvasPos = { x: 0, y: 0 }; // last known canvas coords (for click-subject selection)

// Free Transform State
let isTransforming = false;
let transformBox = null; // { x, y, width, height, rotation: 0 }
let transformActiveHandle = null;
let transformBackupCanvas = null;

// Modal State
let currentAdjustType = null;

// Curves Adjustment State
let currentCurveChannel = 'rgb';
let currentCurvePoints = [
  { input: 0, output: 0 },
  { input: 128, output: 128 },
  { input: 255, output: 255 }
];

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  setupInitialDocument();
  setupCanvasEvents();
  setupShortcuts();
  renderLayersList();
  renderHistory();
  renderDocumentTabs();
  compositeCanvas();
  updateStatus();
  startMarchingAntsLoop();
});

// --- Document Tabs ---
function renderDocumentTabs() {
  const list = document.getElementById('ps-doc-tabs-list');
  if (!list) return;
  list.innerHTML = '';
  documents.forEach((doc) => {
    const tab = document.createElement('div');
    tab.className = `ps-doc-tab ${doc.id === activeDocId ? 'active' : ''}`;
    tab.textContent = doc.name;
    tab.onclick = () => switchDocument(doc.id);
    list.appendChild(tab);
  });
}

function switchDocument(id) {
  if (id === activeDocId) return;
  activeDocId = id;
  renderDocumentTabs();
  setupInitialDocument();
  renderLayersList();
  renderHistory();
  compositeCanvas();
  updateStatus();
}

function addDocument() {
  const id = `Untitled-${documents.length + 1}`;
  documents.push({ id, name: id });
  renderDocumentTabs();
  switchDocument(id);
}

function setupInitialDocument() {
  const mainCanvas = document.getElementById('canvas-main');
  const overlayCanvas = document.getElementById('canvas-overlay');
  mainCanvas.width = docWidth;
  mainCanvas.height = docHeight;
  overlayCanvas.width = docWidth;
  overlayCanvas.height = docHeight;

  // Reset history stack when (re)building the document
  historyStack = [];
  historyIndex = -1;

  // Layer 0: Background
  const bgCanvas = createLayerCanvas();
  const bgCtx = bgCanvas.getContext('2d');
  bgCtx.fillStyle = '#ffffff';
  bgCtx.fillRect(0, 0, docWidth, docHeight);

  // Layer 1: Art Layer
  const artCanvas = createLayerCanvas();
  const artCtx = artCanvas.getContext('2d');
  const grad = artCtx.createRadialGradient(250, 220, 20, 280, 250, 140);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(0.7, '#0284c7');
  grad.addColorStop(1, '#0c4a6e');
  artCtx.fillStyle = grad;
  artCtx.beginPath();
  artCtx.arc(280, 250, 120, 0, Math.PI * 2);
  artCtx.fill();

  artCtx.fillStyle = '#0f172a';
  artCtx.font = 'bold 36px sans-serif';
  artCtx.fillText('MelDraw Professional', 180, 440);

  artCtx.font = '18px sans-serif';
  artCtx.fillStyle = '#64748b';
  artCtx.fillText('Native PSD 8BPS / PackBits RLE Compliant', 180, 480);

  layers = [
    { name: 'Background', visible: true, opacity: 1.0, blendMode: 'normal', canvas: bgCanvas, ctx: bgCtx },
    { name: 'Artwork Layer', visible: true, opacity: 1.0, blendMode: 'normal', canvas: artCanvas, ctx: artCtx }
  ];
  activeLayerIndex = 1;

  pushHistory('Initial State');
}

function createLayerCanvas() {
  const c = document.createElement('canvas');
  c.width = docWidth;
  c.height = docHeight;
  return c;
}

// --- Multi-Layer Compositing Engine ---
function compositeCanvas() {
  const mainCanvas = document.getElementById('canvas-main');
  const mainCtx = mainCanvas.getContext('2d');

  mainCtx.clearRect(0, 0, docWidth, docHeight);

  layers.forEach((layer) => {
    if (!layer.visible) return;

    mainCtx.save();
    mainCtx.globalAlpha = layer.opacity;

    const compMap = {
      'normal': 'source-over',
      'multiply': 'multiply',
      'screen': 'screen',
      'overlay': 'overlay',
      'darken': 'darken',
      'lighten': 'lighten',
      'difference': 'difference'
    };
    mainCtx.globalCompositeOperation = compMap[layer.blendMode] || 'source-over';
    mainCtx.drawImage(layer.canvas, 0, 0);
    mainCtx.restore();
  });
}

// Scale the canvas display to fit the current document inside the viewport
function fitCanvasToViewport() {
  const viewport = document.getElementById('ps-viewport');
  const canvas = document.getElementById('canvas-main');
  if (!viewport || !canvas) return;
  const availW = Math.max(50, viewport.clientWidth - 80); // .ps-viewport padding: 40px each side
  const availH = Math.max(50, viewport.clientHeight - 80);
  const scale = Math.min(availW / docWidth, availH / docHeight);
  canvas.style.width = `${Math.max(1, Math.round(docWidth * scale))}px`;
  canvas.style.height = `${Math.max(1, Math.round(docHeight * scale))}px`;
}

// --- Canvas Interactive Events ---
function setupCanvasEvents() {
  const mainCanvas = document.getElementById('canvas-main');
  mainCanvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

function getCanvasCoords(e) {
  const mainCanvas = document.getElementById('canvas-main');
  const rect = mainCanvas.getBoundingClientRect();
  const pos = {
    x: Math.round((e.clientX - rect.left) * (docWidth / rect.width)),
    y: Math.round((e.clientY - rect.top) * (docHeight / rect.height))
  };
  lastCanvasPos = pos;
  return pos;
}

// Click on a subject (no drag) with the marquee tool: auto-select the subject under the cursor
function selectSubjectAt(x, y) {
  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;

  const ctx = curLayer.ctx;
  const imgData = ctx.getImageData(0, 0, docWidth, docHeight);
  const data = imgData.data;
  const seedIdx = (y * docWidth + x) * 4;
  const tR = data[seedIdx];
  const tG = data[seedIdx + 1];
  const tB = data[seedIdx + 2];

  const visited = new Uint8Array(docWidth * docHeight);
  const queue = [[x, y]];
  visited[y * docWidth + x] = 1;
  let minX = x, maxX = x, minY = y, maxY = y;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop();
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= docWidth || ny < 0 || ny >= docHeight) continue;
      const nPos = ny * docWidth + nx;
      if (visited[nPos]) continue;
      const nIdx = nPos * 4;
      const dist = Math.abs(data[nIdx] - tR) + Math.abs(data[nIdx + 1] - tG) + Math.abs(data[nIdx + 2] - tB);
      if (dist <= tolerance) {
        visited[nPos] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  activeSelection = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  renderOverlay();
  updateStatus();
}

// Auto-select subject by color range: uses current foreground color + tolerance to build a mask and select it.
function autoSelectSubjectByColor() {
  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;

  const ctx = curLayer.ctx;
  const imgData = ctx.getImageData(0, 0, docWidth, docHeight);
  const hex = fgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  const { mask, bounds } = SubjectSegmenter.colorSelectMask(imgData, r, g, b, tolerance);
  if (bounds.width <= 0 || bounds.height <= 0) {
    deselect();
    return;
  }
  activeSelection = bounds;
  renderOverlay();
  updateStatus();
}

function handleMouseDown(e) {
  const pos = getCanvasCoords(e);
  lastX = pos.x;
  lastY = pos.y;
  isPainting = true;

  if (isTransforming) {
    transformActiveHandle = hitTestTransform(pos.x, pos.y);
    return;
  }

  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;
  const ctx = curLayer.ctx;

  if (currentTool === 'eyedropper') {
    sampleColorAt(pos.x, pos.y);
    isPainting = false;
    return;
  }

  if (currentTool === 'marquee') {
    marqueeMoved = false;
    selectionStart = { x: pos.x, y: pos.y };
    activeSelection = null;
    return;
  }

  if (currentTool === 'bucket') {
    applyWithClip(ctx, () => floodFill(curLayer, pos.x, pos.y, fgColor));
    compositeCanvas();
    pushHistory('Paint Bucket');
    isPainting = false;
    return;
  }

  if (currentTool === 'text') {
    startTextEditingAt(pos.x, pos.y);
    isPainting = false;
    return;
  }

  if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
    applyWithClip(ctx, () => drawStroke(pos.x, pos.y, true));
  }
}

function handleMouseMove(e) {
  if (!isPainting) return;
  const pos = getCanvasCoords(e);

  if (isTransforming && transformActiveHandle) {
    applyTransformDrag(pos.x, pos.y);
    renderTransformOverlay();
    return;
  }

  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;
  const ctx = curLayer.ctx;

  if (currentTool === 'marquee' && selectionStart) {
    marqueeMoved = true;
    const x = Math.min(selectionStart.x, pos.x);
    const y = Math.min(selectionStart.y, pos.y);
    const w = Math.abs(pos.x - selectionStart.x);
    const h = Math.abs(pos.y - selectionStart.y);
    activeSelection = { x, y, width: w, height: h };
    return;
  }

  if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
    applyWithClip(ctx, () => drawStroke(pos.x, pos.y, false));
    lastX = pos.x;
    lastY = pos.y;
  } else if (currentTool === 'move') {
    if (activeSelection) {
      // Move only the selected region, not the whole layer
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      applyWithClip(ctx, () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, docWidth, docHeight);
        ctx.globalAlpha = curLayer.opacity;
        ctx.drawImage(curLayer.canvas, -activeSelection.x + dx, -activeSelection.y + dy);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(curLayer.canvas, 0, 0);
        ctx.restore();
        lastX = pos.x;
        lastY = pos.y;
      });
      compositeCanvas();
      return;
    }
    const dx = pos.x - lastX;
    const dy = pos.y - lastY;
    translateLayer(curLayer, dx, dy);
    lastX = pos.x;
    lastY = pos.y;
    compositeCanvas();
  }
}

function handleMouseUp(e) {
  if (!isPainting) return;
  isPainting = false;
  selectionStart = null;
  transformActiveHandle = null;

  if (isTransforming) return;

  if (currentTool === 'marquee') {
    if (marqueeMoved) {
      // Finalize dragged selection
      compositeCanvas();
    } else {
      // Plain click with marquee tool: auto-select subject under cursor
      selectSubjectAt(lastCanvasPos.x, lastCanvasPos.y);
    }
    return;
  }

  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;
  const ctx = curLayer.ctx;

  const pos = getCanvasCoords(e);
  const w = pos.x - lastX;
  const h = pos.y - lastY;

  if (currentTool === 'move') {
    pushHistory('Move Layer');
    return;
  }

  applyWithClip(ctx, () => {
    if (currentTool === 'rect') {
      ctx.fillStyle = fgColor;
      ctx.fillRect(Math.min(lastX, pos.x), Math.min(lastY, pos.y), Math.abs(w), Math.abs(h));
      pushHistory('Rectangle Shape');
    } else if (currentTool === 'oval') {
      ctx.fillStyle = fgColor;
      ctx.beginPath();
      ctx.ellipse(lastX + w / 2, lastY + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      pushHistory('Ellipse Shape');
    } else if (currentTool === 'gradient') {
      const grad = ctx.createLinearGradient(lastX, lastY, pos.x, pos.y);
      grad.addColorStop(0, fgColor);
      grad.addColorStop(1, bgColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, docWidth, docHeight);
      pushHistory('Gradient Tool');
    } else if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
      pushHistory(currentTool.charAt(0).toUpperCase() + currentTool.slice(1));
    }
  });

  compositeCanvas();
}

function applyWithClip(ctx, fn) {
  ctx.save();
  if (activeSelection && activeSelection.width > 0 && activeSelection.height > 0) {
    ctx.beginPath();
    ctx.rect(activeSelection.x, activeSelection.y, activeSelection.width, activeSelection.height);
    ctx.clip();
  }
  fn();
  ctx.restore();
}

// Drawing routines
function drawStroke(x, y, isStart) {
  const curLayer = layers[activeLayerIndex];
  const ctx = curLayer.ctx;

  ctx.save();
  if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = brushBlend;
    ctx.strokeStyle = fgColor;
    ctx.fillStyle = fgColor;
  }

  ctx.globalAlpha = brushOpacity;
  ctx.lineWidth = brushSize;
  ctx.lineCap = currentTool === 'pencil' ? 'square' : 'round';
  ctx.lineJoin = currentTool === 'pencil' ? 'miter' : 'round';

  ctx.beginPath();
  if (isStart) {
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();

  compositeCanvas();
}

// Selection & Marching Ants Loop
function startMarchingAntsLoop() {
  function loop() {
    marchOffset = (marchOffset + 0.5) % 8;
    renderOverlay();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function renderOverlay() {
  const overlay = document.getElementById('canvas-overlay');
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, docWidth, docHeight);

  if (isTransforming && transformBox) {
    renderTransformHandles(ctx);
  } else if (activeSelection && activeSelection.width > 0 && activeSelection.height > 0) {
    // Marching ants dashed box
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -marchOffset;
    ctx.strokeRect(activeSelection.x, activeSelection.y, activeSelection.width, activeSelection.height);

    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = -(marchOffset + 4);
    ctx.strokeRect(activeSelection.x, activeSelection.y, activeSelection.width, activeSelection.height);
    ctx.restore();
  }
}

function deselect() {
  activeSelection = null;
}

// --- Free Transform (Ctrl+T) ---
function startFreeTransform() {
  const curLayer = layers[activeLayerIndex];
  if (!curLayer) return;

  isTransforming = true;
  document.getElementById('opt-group-transform').style.display = 'inline-flex';

  // Backup original layer canvas
  transformBackupCanvas = document.createElement('canvas');
  transformBackupCanvas.width = docWidth;
  transformBackupCanvas.height = docHeight;
  transformBackupCanvas.getContext('2d').drawImage(curLayer.canvas, 0, 0);

  // Initialize transform box to active selection or doc bounds
  if (activeSelection) {
    transformBox = {
      x: activeSelection.x,
      y: activeSelection.y,
      width: activeSelection.width,
      height: activeSelection.height,
      rotation: 0
    };
  } else {
    transformBox = { x: 50, y: 50, width: docWidth - 100, height: docHeight - 100, rotation: 0 };
  }
}

function renderTransformHandles(ctx) {
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(transformBox.x, transformBox.y, transformBox.width, transformBox.height);

  const hs = 7;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';

  const handles = [
    { x: transformBox.x, y: transformBox.y },
    { x: transformBox.x + transformBox.width, y: transformBox.y },
    { x: transformBox.x + transformBox.width, y: transformBox.y + transformBox.height },
    { x: transformBox.x, y: transformBox.y + transformBox.height },
    { x: transformBox.x + transformBox.width / 2, y: transformBox.y },
    { x: transformBox.x + transformBox.width / 2, y: transformBox.y + transformBox.height },
    { x: transformBox.x, y: transformBox.y + transformBox.height / 2 },
    { x: transformBox.x + transformBox.width, y: transformBox.y + transformBox.height / 2 }
  ];

  handles.forEach(p => {
    ctx.fillRect(p.x - hs / 2, p.y - hs / 2, hs, hs);
    ctx.strokeRect(p.x - hs / 2, p.y - hs / 2, hs, hs);
  });

  ctx.restore();
}

function hitTestTransform(x, y) {
  if (!transformBox) return null;
  const hs = 10;
  if (Math.hypot(x - (transformBox.x + transformBox.width), y - (transformBox.y + transformBox.height)) <= hs) return 'se';
  if (Math.hypot(x - transformBox.x, y - (transformBox.y + transformBox.height)) <= hs) return 'sw';
  if (Math.hypot(x - (transformBox.x + transformBox.width), y - transformBox.y) <= hs) return 'ne';
  if (Math.hypot(x - transformBox.x, y - transformBox.y) <= hs) return 'nw';
  return 'drag';
}

function applyTransformDrag(x, y) {
  if (transformActiveHandle === 'se') {
    transformBox.width = Math.max(20, x - transformBox.x);
    transformBox.height = Math.max(20, y - transformBox.y);
  } else if (transformActiveHandle === 'drag') {
    transformBox.x += (x - lastX);
    transformBox.y += (y - lastY);
    lastX = x;
    lastY = y;
  }
}

function commitFreeTransform() {
  const curLayer = layers[activeLayerIndex];
  if (curLayer && transformBackupCanvas) {
    curLayer.ctx.clearRect(0, 0, docWidth, docHeight);
    curLayer.ctx.drawImage(transformBackupCanvas, transformBox.x, transformBox.y, transformBox.width, transformBox.height);
    compositeCanvas();
    pushHistory('Free Transform');
  }
  cancelFreeTransform();
}

function cancelFreeTransform() {
  isTransforming = false;
  transformBox = null;
  transformBackupCanvas = null;
  document.getElementById('opt-group-transform').style.display = 'none';
  renderOverlay();
}

// --- Layer Transformations & Flood Fill ---
function translateLayer(layer, dx, dy) {
  const temp = document.createElement('canvas');
  temp.width = docWidth;
  temp.height = docHeight;
  temp.getContext('2d').drawImage(layer.canvas, 0, 0);

  layer.ctx.clearRect(0, 0, docWidth, docHeight);
  layer.ctx.drawImage(temp, dx, dy);
}

function floodFill(layer, startX, startY, hexColor) {
  const ctx = layer.ctx;
  const imgData = ctx.getImageData(0, 0, docWidth, docHeight);
  const data = imgData.data;

  const targetIdx = (startY * docWidth + startX) * 4;
  const targetR = data[targetIdx];
  const targetG = data[targetIdx + 1];
  const targetB = data[targetIdx + 2];
  const targetA = data[targetIdx + 3];

  const fillRgb = hexToRgb(hexColor);
  if (colorDist(targetR, targetG, targetB, targetA, fillRgb.r, fillRgb.g, fillRgb.b, 255) === 0) return;

  const queue = [[startX, startY]];
  const visited = new Uint8Array(docWidth * docHeight);
  visited[startY * docWidth + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const idx = (y * docWidth + x) * 4;

    data[idx] = fillRgb.r;
    data[idx + 1] = fillRgb.g;
    data[idx + 2] = fillRgb.b;
    data[idx + 3] = 255;

    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < docWidth && ny >= 0 && ny < docHeight) {
        const nPos = ny * docWidth + nx;
        if (!visited[nPos]) {
          visited[nPos] = 1;
          const nIdx = nPos * 4;
          if (colorDist(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3], targetR, targetG, targetB, targetA) <= tolerance) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function colorDist(r1, g1, b1, a1, r2, g2, b2, a2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2);
}

function sampleColorAt(x, y) {
  const mainCanvas = document.getElementById('canvas-main');
  const ctx = mainCanvas.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
  setFgColor(hex);
}

// In-place text editing overlay for the Type (T) tool
function startTextEditingAt(x, y) {
  const canvas = document.getElementById('canvas-main');
  const rect = canvas.getBoundingClientRect();
  const overlay = document.createElement('textarea');
  overlay.id = 'meldraw-text-editor';
  overlay.value = '';
  overlay.style.position = 'fixed';
  overlay.style.left = `${rect.left + (x / docWidth) * rect.width}px`;
  overlay.style.top = `${rect.top + (y / docHeight) * rect.height}px`;
  overlay.style.font = `${brushSize * 2}px sans-serif`;
  overlay.style.color = fgColor;
  overlay.style.background = 'rgba(255, 255, 255, 0.92)';
  overlay.style.border = '1px dashed #38bdf8';
  overlay.style.padding = '2px 4px';
  overlay.style.zIndex = '5000';
  overlay.style.minWidth = '120px';
  overlay.style.resize = 'none';
  overlay.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  overlay.focus();
  overlay.select();

  const commitText = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    const text = (overlay.value || '').trim();
    if (text) {
      const layer = layers[activeLayerIndex];
      if (layer) {
        layer.ctx.save();
        layer.ctx.font = `${brushSize * 2}px sans-serif`;
        layer.ctx.fillStyle = fgColor;
        layer.ctx.fillText(text, x, y);
        layer.ctx.restore();
        compositeCanvas();
        pushHistory('Text Tool');
      }
    }
  };

  overlay.addEventListener('blur', commitText);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      overlay.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      overlay.blur();
    }
  });
}


// --- Filters & Adjustments ---
function applyFilter(filterName) {
  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;

  const ctx = curLayer.ctx;
  applyWithClip(ctx, () => {
    const imgData = ctx.getImageData(0, 0, docWidth, docHeight);
    let filtered;
    if (filterName === 'sharpen') filtered = Filters.sharpen(imgData);
    else if (filterName === 'blur') filtered = Filters.blur(imgData);
    else if (filterName === 'findEdges') filtered = Filters.findEdges(imgData);
    else if (filterName === 'emboss') filtered = Filters.emboss(imgData);
    else if (filterName === 'grayscale') filtered = Filters.grayscale(imgData);
    else if (filterName === 'invert') filtered = Filters.invert(imgData);
    else if (filterName === 'sepia') filtered = Filters.sepia(imgData);
    else if (filterName === 'threshold') filtered = Filters.threshold(imgData, 128);

    if (filtered) {
      ctx.putImageData(filtered, 0, 0);
      compositeCanvas();
      pushHistory(`Filter: ${filterName}`);
    }
  });
}

function openAdjustDialog(type) {
  currentAdjustType = type;
  const modal = document.getElementById('adjustment-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  modal.style.display = 'flex';
  if (type === 'brightness') {
    title.textContent = 'Brightness & Contrast';
    body.innerHTML = `
      <div style="display:flex; justify-content:space-between;"><label>Brightness:</label><input type="range" id="adj-bright" min="-100" max="100" value="0"></div>
      <div style="display:flex; justify-content:space-between;"><label>Contrast:</label><input type="range" id="adj-contrast" min="-100" max="100" value="0"></div>
    `;
  } else if (type === 'hsv') {
    title.textContent = 'Hue & Saturation';
    body.innerHTML = `
      <div style="display:flex; justify-content:space-between;"><label>Hue:</label><input type="range" id="adj-hue" min="-180" max="180" value="0"></div>
      <div style="display:flex; justify-content:space-between;"><label>Saturation:</label><input type="range" id="adj-sat" min="-100" max="100" value="0"></div>
    `;
  } else if (type === 'curves') {
    title.textContent = 'Curves';
    body.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <label>Channel:</label>
        <select class="opt-select" id="adj-curve-channel" onchange="renderCurveEditor()">
          <option value="rgb">RGB Composite</option>
          <option value="r">Red</option>
          <option value="g">Green</option>
          <option value="b">Blue</option>
        </select>
      </div>
      <div id="curves-points-container" style="display:flex; flex-direction:column; gap:6px;">
        <!-- Rendered dynamically -->
      </div>
      <button class="btn-ps-mini" onclick="addCurvePoint()">+ Add Curve Point</button>
    `;
    renderCurveEditor();
  }
}

function renderCurveEditor() {
  const container = document.getElementById('curves-points-container');
  if (!container) return;
  container.innerHTML = '';
  currentCurvePoints.forEach((p, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';

    const inLabel = document.createElement('label');
    inLabel.textContent = `P${idx + 1} in`;
    inLabel.style.fontSize = '10px';
    inLabel.style.width = '34px';
    row.appendChild(inLabel);

    const inInput = document.createElement('input');
    inInput.type = 'number';
    inInput.min = '0';
    inInput.max = '255';
    inInput.value = p.input;
    inInput.style.width = '48px';
    inInput.addEventListener('input', () => {
      currentCurvePoints[idx].input = parseInt(inInput.value, 10) || 0;
    });
    row.appendChild(inInput);

    const outLabel = document.createElement('label');
    outLabel.textContent = 'out';
    outLabel.style.fontSize = '10px';
    outLabel.style.width = '30px';
    row.appendChild(outLabel);

    const outInput = document.createElement('input');
    outInput.type = 'number';
    outInput.min = '0';
    outInput.max = '255';
    outInput.value = p.output;
    outInput.style.width = '48px';
    outInput.addEventListener('input', () => {
      currentCurvePoints[idx].output = parseInt(outInput.value, 10) || 0;
    });
    row.appendChild(outInput);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-ps-mini';
    delBtn.textContent = '✕';
    delBtn.style.padding = '0 6px';
    delBtn.addEventListener('click', () => removeCurvePoint(idx));
    row.appendChild(delBtn);

    container.appendChild(row);
  });
}

function addCurvePoint() {
  const last = currentCurvePoints[currentCurvePoints.length - 1];
  currentCurvePoints.push({ input: Math.min(254, last.input + 1), output: Math.min(254, last.output + 1) });
  renderCurveEditor();
}

function removeCurvePoint(idx) {
  if (currentCurvePoints.length <= 2) return; // keep at least endpoints
  currentCurvePoints.splice(idx, 1);
  renderCurveEditor();
}

function readCurvePoints() {
  const pts = currentCurvePoints
    .map(p => ({ input: Math.max(0, Math.min(255, parseInt(p.input, 10) || 0)), output: Math.max(0, Math.min(255, parseInt(p.output, 10) || 0)) }))
    .sort((a, b) => a.input - b.input);
  return pts;
}

function applyAdjustmentModal() {
  const curLayer = layers[activeLayerIndex];
  if (curLayer && currentAdjustType === 'brightness') {
    const b = parseInt(document.getElementById('adj-bright').value, 10);
    const c = parseInt(document.getElementById('adj-contrast').value, 10);
    const imgData = curLayer.ctx.getImageData(0, 0, docWidth, docHeight);
    const d = imgData.data;
    const factor = (259 * (c + 255)) / (255 * (259 - c));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = factor * (d[i] + b - 128) + 128;
      d[i + 1] = factor * (d[i + 1] + b - 128) + 128;
      d[i + 2] = factor * (d[i + 2] + b - 128) + 128;
    }
    curLayer.ctx.putImageData(imgData, 0, 0);
    compositeCanvas();
    pushHistory('Brightness/Contrast');
  } else if (curLayer && currentAdjustType === 'curves') {
    const points = readCurvePoints();
    const channel = document.getElementById('adj-curve-channel').value;
    const imgData = curLayer.ctx.getImageData(0, 0, docWidth, docHeight);
    Filters.applyCurves(imgData, { points }, channel);
    curLayer.ctx.putImageData(imgData, 0, 0);
    compositeCanvas();
    pushHistory('Curves');
  }
  closeAdjustmentModal();
}

function closeAdjustmentModal() {
  document.getElementById('adjustment-modal').style.display = 'none';
}

// --- History Engine ---
function pushHistory(name) {
  if (historyIndex < historyStack.length - 1) {
    historyStack = historyStack.slice(0, historyIndex + 1);
  }

  const snapshot = layers.map(l => {
    const snapCanvas = createLayerCanvas();
    snapCanvas.getContext('2d').drawImage(l.canvas, 0, 0);
    return {
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      canvas: snapCanvas
    };
  });

  historyStack.push({ name, snapshot });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  historyIndex = historyStack.length - 1;

  renderHistory();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreHistory(historyIndex);
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    restoreHistory(historyIndex);
  }
}

function restoreHistory(idx) {
  const item = historyStack[idx];
  if (!item) return;

  layers = item.snapshot.map(s => {
    const c = createLayerCanvas();
    const ctx = c.getContext('2d');
    ctx.drawImage(s.canvas, 0, 0);
    return {
      name: s.name,
      visible: s.visible,
      opacity: s.opacity,
      blendMode: s.blendMode,
      canvas: c,
      ctx
    };
  });

  if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;

  renderLayersList();
  renderHistory();
  compositeCanvas();
  updateStatus();
}

function renderHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = '';
  historyStack.forEach((h, idx) => {
    const div = document.createElement('div');
    div.className = `history-item ${idx === historyIndex ? 'active' : ''}`;
    div.textContent = h.name;
    div.onclick = () => {
      historyIndex = idx;
      restoreHistory(idx);
    };
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

// --- Layers Operations ---
function renderLayersList() {
  const list = document.getElementById('layers-list');
  list.innerHTML = '';

  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const row = document.createElement('div');
    row.className = `layer-row ${i === activeLayerIndex ? 'active' : ''}`;
    row.onclick = () => selectLayer(i);

    const eye = document.createElement('span');
    eye.textContent = l.visible ? '👁' : '🚫';
    eye.onclick = (e) => {
      e.stopPropagation();
      toggleLayerVis(i);
    };

    const name = document.createElement('span');
    name.textContent = l.name;
    name.style.flex = '1';

    row.appendChild(eye);
    row.appendChild(name);
    list.appendChild(row);
  }

  const cur = layers[activeLayerIndex];
  if (cur) {
    document.getElementById('layer-blend-select').value = cur.blendMode;
    document.getElementById('layer-opacity-input').value = Math.round(cur.opacity * 100);
  }
}

function selectLayer(idx) {
  activeLayerIndex = idx;
  renderLayersList();
  updateStatus();
}

function toggleLayerVis(idx) {
  layers[idx].visible = !layers[idx].visible;
  renderLayersList();
  compositeCanvas();
}

function addNewLayer() {
  const c = createLayerCanvas();
  layers.push({
    name: `Layer ${layers.length}`,
    visible: true,
    opacity: 1.0,
    blendMode: 'normal',
    canvas: c,
    ctx: c.getContext('2d')
  });
  activeLayerIndex = layers.length - 1;
  renderLayersList();
  pushHistory('New Layer');
}

function duplicateActiveLayer() {
  const cur = layers[activeLayerIndex];
  if (!cur) return;
  const c = createLayerCanvas();
  c.getContext('2d').drawImage(cur.canvas, 0, 0);
  layers.splice(activeLayerIndex + 1, 0, {
    name: `${cur.name} Copy`,
    visible: true,
    opacity: cur.opacity,
    blendMode: cur.blendMode,
    canvas: c,
    ctx: c.getContext('2d')
  });
  activeLayerIndex++;
  renderLayersList();
  compositeCanvas();
  pushHistory('Duplicate Layer');
}

function deleteActiveLayer() {
  if (layers.length <= 1) {
    alert('Document must have at least one layer.');
    return;
  }
  layers.splice(activeLayerIndex, 1);
  if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
  renderLayersList();
  compositeCanvas();
  pushHistory('Delete Layer');
}

function mergeDownLayer() {
  if (activeLayerIndex <= 0) return;
  const top = layers[activeLayerIndex];
  const bottom = layers[activeLayerIndex - 1];

  bottom.ctx.save();
  bottom.ctx.globalAlpha = top.opacity;
  bottom.ctx.drawImage(top.canvas, 0, 0);
  bottom.ctx.restore();

  layers.splice(activeLayerIndex, 1);
  activeLayerIndex--;
  renderLayersList();
  compositeCanvas();
  pushHistory('Merge Down');
}

function changeLayerBlend(mode) {
  const cur = layers[activeLayerIndex];
  if (cur) {
    cur.blendMode = mode;
    compositeCanvas();
  }
}

function changeLayerOpacity(val) {
  const cur = layers[activeLayerIndex];
  if (cur) {
    cur.opacity = Math.max(0, Math.min(1, val / 100));
    compositeCanvas();
  }
}

// Tool setting
function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.btn-ps-tool').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${tool}`);
  if (btn) btn.classList.add('active');

  // Toggle contextual option groups
  document.getElementById('opt-group-tolerance').style.display = (tool === 'wand' || tool === 'bucket') ? 'inline-flex' : 'none';
}

function updateBrushSize(val) {
  brushSize = parseInt(val, 10);
  document.getElementById('lbl-brush-size').textContent = `${val}px`;
}

function updateBrushOpacity(val) {
  brushOpacity = parseInt(val, 10) / 100;
  document.getElementById('lbl-brush-opacity').textContent = `${val}%`;
}

function updateBrushBlend(mode) {
  brushBlend = mode;
}

function updateTolerance(val) {
  tolerance = parseInt(val, 10);
}

function setFgColor(hex) {
  fgColor = hex;
  document.getElementById('chip-fg').style.backgroundColor = hex;
}

function setBgColor(hex) {
  bgColor = hex;
  document.getElementById('chip-bg').style.backgroundColor = hex;
}

function swapColors() {
  const temp = fgColor;
  setFgColor(bgColor);
  setBgColor(temp);
}

function pickColor(target) {
  pickTarget = target;
  document.getElementById('hidden-color-picker').click();
}

function handleColorPick(e) {
  if (pickTarget === 'fg') setFgColor(e.target.value);
  else setBgColor(e.target.value);
}

function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      startFreeTransform();
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      deselect();
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      redo();
    } else if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      applyFilter('invert');
    } else if (e.key === 'Enter' && isTransforming) {
      e.preventDefault();
      commitFreeTransform();
    } else if (e.key === 'Escape') {
      if (isTransforming) cancelFreeTransform();
      else deselect();
    } else if (e.key === 'v' || e.key === 'V') {
      setTool('move');
    } else if (e.key === 'm' || e.key === 'M') {
      setTool('marquee');
    } else if (e.key === 'b' || e.key === 'B') {
      setTool('brush');
    } else if (e.key === 'e' || e.key === 'E') {
      setTool('eraser');
    } else if (e.key === 'g' || e.key === 'G') {
      setTool('bucket');
    } else if (e.key === 'x' || e.key === 'X') {
      swapColors();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelectionWithArrowKeys(e.key);
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      copySelection();
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      pasteSelection();
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      duplicateSelection();
    } else if (e.key === 't' || e.key === 'T') {
      setTool('text');
    }
  });
}

function moveLayerBy(delta) {
  const target = activeLayerIndex + delta;
  if (target < 0 || target >= layers.length || target === activeLayerIndex) return;
  const cur = layers[activeLayerIndex];
  layers.splice(activeLayerIndex, 1);
  layers.splice(target, 0, cur);
  activeLayerIndex = target;
  renderLayersList();
  compositeCanvas();
  updateStatus();
}

function moveSelectionWithArrowKeys(key) {
  if (activeSelection) {
    let dx = 0, dy = 0;
    if (key === 'ArrowLeft') dx = -1;
    else if (key === 'ArrowRight') dx = 1;
    else if (key === 'ArrowUp') dy = -1;
    else if (key === 'ArrowDown') dy = 1;

    const step = Math.max(1, Math.round(10 / (docWidth / 800)));
    const moveX = Math.round(dx * step);
    const moveY = Math.round(dy * step);

    if (activeSelection.x + moveX < 0) return;
    if (activeSelection.x + moveX + activeSelection.width > docWidth) return;
    if (activeSelection.y + moveY < 0) return;
    if (activeSelection.y + moveY + activeSelection.height > docHeight) return;

    activeSelection.x += moveX;
    activeSelection.y += moveY;
    renderOverlay();
  }
}

function deleteSelected() {
  if (activeSelection) {
    // Delete selected region from active layer via mask
    const curLayer = layers[activeLayerIndex];
    if (curLayer && curLayer.visible) {
      applyWithClip(curLayer.ctx, () => {
        // Paint background color to clear the selection
        curLayer.ctx.save();
        curLayer.ctx.fillStyle = '#ffffff';
        curLayer.ctx.fillRect(activeSelection.x, activeSelection.y, activeSelection.width, activeSelection.height);
        curLayer.ctx.restore();
      });
      compositeCanvas();
      pushHistory('Delete Selection');
    }
    deselect();
  } else {
    // Delete selected layer
    deleteActiveLayer();
  }
}

function copySelection() {
  if (activeSelection && layers[activeLayerIndex]) {
    const curLayer = layers[activeLayerIndex];
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = docWidth;
    srcCanvas.height = docHeight;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(curLayer.canvas, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = docWidth;
    dstCanvas.height = docHeight;
    const dstCtx = dstCanvas.getContext('2d');
    dstCtx.drawImage(srcCanvas, 0, 0);
    dstCtx.setTransform(1, 0, 0, 1, 0, 0);
    dstCtx.clearRect(0, 0, docWidth, docHeight);
    dstCtx.drawImage(srcCanvas, 0, 0);

    const clipboardLayer = {
      name: `${curLayer.name} Copy`,
      visible: true,
      opacity: curLayer.opacity,
      blendMode: curLayer.blendMode,
      canvas: dstCanvas,
      ctx: dstCtx
    };
    // Push to layers at end
    layers.push(clipboardLayer);
    activeLayerIndex = layers.length - 1;
    renderLayersList();
    compositeCanvas();
    pushHistory('Copy Layer');
  }
}

function pasteSelection() {
  // Paste clipboard content at last position
  const clipboardLayers = layers.filter(l => l.name && l.name.endsWith(' Copy'));
  // Simply paste as duplicate of active layer at new location
  // Simplified: push a new layer with current content
  const curLayer = layers[activeLayerIndex];
  if (curLayer) {
    const c = createLayerCanvas();
    c.getContext('2d').drawImage(curLayer.canvas, 0, 0);
    layers.push({
      name: `${curLayer.name} Paste`,
      visible: true,
      opacity: curLayer.opacity,
      blendMode: curLayer.blendMode,
      canvas: c,
      ctx: c.getContext('2d')
    });
    activeLayerIndex = layers.length - 1;
    renderLayersList();
    compositeCanvas();
    pushHistory('Paste Layer');
  }
}

function duplicateSelection() {
  if (activeSelection) {
    const curLayer = layers[activeLayerIndex];
    if (curLayer) {
      applyWithClip(curLayer.ctx, () => {
        curLayer.ctx.save();
        curLayer.ctx.globalAlpha = curLayer.opacity;
        curLayer.ctx.drawImage(curLayer.canvas, activeSelection.x, activeSelection.y);
        curLayer.ctx.restore();
      });
      compositeCanvas();
      pushHistory('Duplicate Selection');
    }
  }
}

// --- Native PSD Binary Export ---
function savePsd() {
  const w = docWidth;
  const h = docHeight;

  const psdLayers = layers.map(layer => {
    const imgData = layer.ctx.getImageData(0, 0, w, h);
    const rgbaData = Buffer.from(imgData.data);
    return {
      name: layer.name,
      top: 0,
      left: 0,
      bottom: h,
      right: w,
      opacity: Math.round(layer.opacity * 255),
      blendMode: layer.blendMode || 'normal',
      visible: layer.visible !== false,
      rgbaData: rgbaData
    };
  });

  const psdDoc = new PsdDocument({
    width: w,
    height: h,
    layers: psdLayers
  });

  const psdBuf = psdDoc.toBuffer();
  const blob = new Blob([psdBuf], { type: 'application/octet-stream' });
  downloadBlob(blob, 'MelDraw-Document.psd');
}

function triggerOpen() {
  document.getElementById('file-input').click();
}

async function handleFileOpen(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.psd')) {
    const buf = Buffer.from(new Uint8Array(await file.arrayBuffer()));
    loadPsdBuffer(buf);
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      docWidth = img.width;
      docHeight = img.height;
      layers.forEach(l => { l.canvas.width = docWidth; l.canvas.height = docHeight; });
      const bg = layers[0];
      if (bg && bg.visible) { bg.ctx.fillStyle = '#ffffff'; bg.ctx.fillRect(0, 0, docWidth, docHeight); }
      addNewLayer();
      const cur = layers[activeLayerIndex];
      cur.name = file.name;
      cur.ctx.clearRect(0, 0, docWidth, docHeight);
      cur.ctx.drawImage(img, 0, 0);
      compositeCanvas();
      fitCanvasToViewport();
      renderLayersList();
      pushHistory(`Open Image: ${file.name}`);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}

function loadPsdBuffer(buf) {
  try {
    const psd = PsdDocument.parse(buf);
    // Set document dimensions
    docWidth = psd.width;
    docHeight = psd.height;

    // Clear current layers
    layers = [];

    const mainCanvas = document.getElementById('canvas-main');
    const overlayCanvas = document.getElementById('canvas-overlay');
    mainCanvas.width = docWidth;
    mainCanvas.height = docHeight;
    overlayCanvas.width = docWidth;
    overlayCanvas.height = docHeight;

    // Convert PSD layers to app layers
    psd.layers.forEach(psdLayer => {
      // Create canvas element for this layer
      const canvas = document.createElement('canvas');
      canvas.width = psd.width;
      canvas.height = psd.height;
      const ctx = canvas.getContext('2d');

      // Transfer RGBA data to canvas
      const imgData = ctx.createImageData(psd.width, psd.height);
      // psdLayer.rgbaData is Node Buffer, convert to Uint8Array
      const data = new Uint8Array(psdLayer.rgbaData);
      imgData.data.set(data);
      ctx.putImageData(imgData, 0, 0);

      // Push new layer object
      layers.push({
        name: psdLayer.name,
        visible: psdLayer.visible,
        opacity: (psdLayer.opacity !== undefined ? psdLayer.opacity / 255 : 1.0),
        blendMode: psdLayer.blendMode,
        canvas: canvas,
        ctx: ctx
      });
    });

    activeLayerIndex = layers.length > 0 ? 0 : 0;
    renderLayersList();
    compositeCanvas();
    fitCanvasToViewport();
    pushHistory('PSD Load');
  } catch (e) {
    alert('Failed to load PSD: ' + e.message);
  }
}

function exportPng() {
  const mainCanvas = document.getElementById('canvas-main');
  mainCanvas.toBlob((blob) => {
    downloadBlob(blob, 'MelDraw-Export.png');
  }, 'image/png');
}

function newDocument() {
  setupInitialDocument();
  renderLayersList();
  renderHistory();
  compositeCanvas();
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

function updateStatus() {
  const cur = layers[activeLayerIndex];
  document.getElementById('ps-status-right').textContent = `Doc: ${docWidth} x ${docHeight} px (RGB/8) | Layer: ${cur ? cur.name : 'None'}`;
}
