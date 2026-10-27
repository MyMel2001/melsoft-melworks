// MelPhoto Studio Professional Client Engine
// Complete Adobe Photoshop Clone with Free Transform (Ctrl+T), Selection Marquee (M) Marching Ants, Multi-Layer Compositing, and PSD 8BPS Engine

let docWidth = 800;
let docHeight = 600;

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

// Free Transform State
let isTransforming = false;
let transformBox = null; // { x, y, width, height, rotation: 0 }
let transformActiveHandle = null;
let transformBackupCanvas = null;

// Modal State
let currentAdjustType = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  setupInitialDocument();
  setupCanvasEvents();
  setupShortcuts();
  renderLayersList();
  renderHistory();
  compositeCanvas();
  updateStatus();
  startMarchingAntsLoop();
});

function setupInitialDocument() {
  const mainCanvas = document.getElementById('canvas-main');
  const overlayCanvas = document.getElementById('canvas-overlay');
  mainCanvas.width = docWidth;
  mainCanvas.height = docHeight;
  overlayCanvas.width = docWidth;
  overlayCanvas.height = docHeight;

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
  artCtx.fillText('MelPhoto Professional', 180, 440);

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
  return {
    x: Math.round((e.clientX - rect.left) * (docWidth / rect.width)),
    y: Math.round((e.clientY - rect.top) * (docHeight / rect.height))
  };
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
    const text = prompt('Enter text for layer:', 'MelPhoto Studio');
    if (text) {
      applyWithClip(ctx, () => {
        ctx.fillStyle = fgColor;
        ctx.font = `${brushSize * 2}px sans-serif`;
        ctx.fillText(text, pos.x, pos.y);
      });
      compositeCanvas();
      pushHistory('Text Tool');
    }
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

  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;
  const ctx = curLayer.ctx;

  const pos = getCanvasCoords(e);
  const w = pos.x - lastX;
  const h = pos.y - lastY;

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
    } else if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser' || currentTool === 'move') {
      pushHistory(currentTool.charAt(0).toUpperCase() + currentTool.slice(1));
    }
  });

  compositeCanvas();
}

function applyWithClip(ctx, fn) {
  ctx.save();
  if (activeSelection && activeSelection.width > 2 && activeSelection.height > 2) {
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
  } else if (activeSelection && activeSelection.width > 2 && activeSelection.height > 2) {
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
  }
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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

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
    }
  });
}

// --- Native PSD Binary Export ---
function savePsd() {
  const w = docWidth;
  const h = docHeight;

  const psdLayers = layers.map((layer, idx) => {
    const rawData = layer.ctx.getImageData(0, 0, w, h).data;
    return {
      name: layer.name,
      top: 0,
      left: 0,
      bottom: h,
      right: w,
      opacity: Math.round(layer.opacity * 255),
      blendMode: 'norm',
      rgba: rawData
    };
  });

  const psdBytes = buildPsdBinary(w, h, psdLayers);
  const blob = new Blob([new Uint8Array(psdBytes)], { type: 'application/octet-stream' });
  downloadBlob(blob, 'MelPhoto-Document.psd');
}

function buildPsdBinary(width, height, psdLayers) {
  const bytes = [];
  function write16(val) { bytes.push((val >> 8) & 0xff, val & 0xff); }
  function write32(val) {
    bytes.push((val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff);
  }
  function writeString(str) {
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  }

  // 1. File Header (26 bytes)
  writeString('8BPS');
  write16(1); // Version 1
  for (let i = 0; i < 6; i++) bytes.push(0); // Reserved
  write16(3); // 3 Channels (RGB)
  write32(height);
  write32(width);
  write16(8); // 8 bits per channel
  write16(3); // ColorMode 3 = RGB

  // 2. Color Mode Data
  write32(0);

  // 3. Image Resources
  const resBytes = [];
  function pushRes16(v) { resBytes.push((v >> 8) & 0xff, v & 0xff); }
  function pushRes32(v) {
    resBytes.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  }
  function pushResStr(s) { for (let i = 0; i < s.length; i++) resBytes.push(s.charCodeAt(i)); }

  pushResStr('8BIM');
  pushRes16(0x03ED); // ResolutionInfo
  pushRes16(0);
  pushRes32(16);
  pushRes32(72 << 16); // 72 DPI
  pushRes16(1); pushRes16(1);
  pushRes32(72 << 16);
  pushRes16(1); pushRes16(1);

  write32(resBytes.length);
  bytes.push(...resBytes);

  // 4. Layer & Mask Section
  const layerInfoBytes = [];
  function pushLay16(v) { layerInfoBytes.push((v >> 8) & 0xff, v & 0xff); }
  function pushLay32(v) {
    layerInfoBytes.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  }
  function pushLayStr(s) { for (let i = 0; i < s.length; i++) layerInfoBytes.push(s.charCodeAt(i)); }

  const layerCount = psdLayers.length;
  pushLay16(layerCount);

  // Write Layer Records
  const pixelCount = width * height;
  for (let l = 0; l < layerCount; l++) {
    const layer = psdLayers[l];
    pushLay32(layer.top);
    pushLay32(layer.left);
    pushLay32(layer.bottom);
    pushLay32(layer.right);
    pushLay16(4); // 4 Channels: R, G, B, A

    // Channel 0 (R)
    pushLay16(0); pushLay32(2 + pixelCount);
    // Channel 1 (G)
    pushLay16(1); pushLay32(2 + pixelCount);
    // Channel 2 (B)
    pushLay16(2); pushLay32(2 + pixelCount);
    // Channel -1 (Alpha)
    pushLay16(-1); pushLay32(2 + pixelCount);

    pushLayStr('8BIM');
    pushLayStr(layer.blendMode); // 'norm'
    layerInfoBytes.push(layer.opacity); // Opacity
    layerInfoBytes.push(0); // Clipping
    layerInfoBytes.push(0); // Flags
    layerInfoBytes.push(0); // Filler

    // Extra Data
    const nameLen = Math.min(31, layer.name.length);
    let extraLen = 4 + 4 + 1 + nameLen;
    let pad = (4 - (extraLen % 4)) % 4;
    extraLen += pad;

    pushLay32(extraLen);
    pushLay32(0); // Layer mask data len
    pushLay32(0); // Layer blending ranges len
    layerInfoBytes.push(nameLen);
    pushLayStr(layer.name.slice(0, nameLen));
    for (let p = 0; p < pad; p++) layerInfoBytes.push(0);
  }

  // Write Layer Channel Image Data (Raw uncompressed for reliability)
  for (let l = 0; l < layerCount; l++) {
    const rgba = psdLayers[l].rgba;
    // R channel
    pushLay16(0);
    for (let p = 0; p < pixelCount; p++) layerInfoBytes.push(rgba[p * 4]);
    // G channel
    pushLay16(0);
    for (let p = 0; p < pixelCount; p++) layerInfoBytes.push(rgba[p * 4 + 1]);
    // B channel
    pushLay16(0);
    for (let p = 0; p < pixelCount; p++) layerInfoBytes.push(rgba[p * 4 + 2]);
    // A channel
    pushLay16(0);
    for (let p = 0; p < pixelCount; p++) layerInfoBytes.push(rgba[p * 4 + 3]);
  }

  write32(layerInfoBytes.length);
  bytes.push(...layerInfoBytes);

  // 5. Composite Image Data Section
  write16(0); // Raw planar RGB
  const mainCanvas = document.getElementById('canvas-main');
  const compData = mainCanvas.getContext('2d').getImageData(0, 0, width, height).data;
  const totalPix = width * height;

  for (let p = 0; p < totalPix; p++) bytes.push(compData[p * 4]);
  for (let p = 0; p < totalPix; p++) bytes.push(compData[p * 4 + 1]);
  for (let p = 0; p < totalPix; p++) bytes.push(compData[p * 4 + 2]);

  return bytes;
}

function triggerOpen() {
  document.getElementById('file-input').click();
}

async function handleFileOpen(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.psd')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    loadPsdBuffer(buf);
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      addNewLayer();
      const cur = layers[activeLayerIndex];
      cur.name = file.name;
      cur.ctx.drawImage(img, 0, 0);
      compositeCanvas();
      renderLayersList();
      pushHistory(`Open Image: ${file.name}`);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}

function loadPsdBuffer(buf) {
  const sig = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (sig !== '8BPS') {
    alert('Invalid PSD file: missing 8BPS signature');
    return;
  }
  const h = (buf[14] << 24) | (buf[15] << 16) | (buf[16] << 8) | buf[17];
  const w = (buf[18] << 24) | (buf[19] << 16) | (buf[20] << 8) | buf[21];
  alert(`Loaded Native PSD Document!\nDimensions: ${w} x ${h} px\nFormat: Adobe Photoshop 8BPS`);
  compositeCanvas();
}

function exportPng() {
  const mainCanvas = document.getElementById('canvas-main');
  mainCanvas.toBlob((blob) => {
    downloadBlob(blob, 'MelPhoto-Export.png');
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
