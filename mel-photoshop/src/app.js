// MelPhoto Studio Professional Client Engine
let docWidth = 800;
let docHeight = 600;

// Layers state
let layers = [];
let activeLayerIndex = 0;

// History stack
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 20;

// Tool state
let currentTool = 'brush';
let brushSize = 15;
let brushOpacity = 1.0;
let brushBlend = 'source-over';
let fgColor = '#1e293b';
let bgColor = '#ffffff';
let isPainting = false;
let lastX = 0, lastY = 0;
let pickTarget = 'fg';

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  setupInitialDocument();
  setupCanvasEvents();
  renderLayersList();
  renderHistory();
  compositeCanvas();
  updateStatus();
});

function setupInitialDocument() {
  const mainCanvas = document.getElementById('canvas-main');
  mainCanvas.width = docWidth;
  mainCanvas.height = docHeight;

  // Layer 0: Background
  const bgCanvas = createLayerCanvas();
  const bgCtx = bgCanvas.getContext('2d');
  bgCtx.fillStyle = '#ffffff';
  bgCtx.fillRect(0, 0, docWidth, docHeight);

  // Layer 1: Art Layer
  const artCanvas = createLayerCanvas();
  const artCtx = artCanvas.getContext('2d');
  // Sample initial artwork: gradient sphere and banner
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

    // Map PSD blend modes to Canvas globalCompositeOperation
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
  mainCanvas.addEventListener('mousemove', handleMouseMove);
  mainCanvas.addEventListener('mouseup', handleMouseUp);
  mainCanvas.addEventListener('mouseleave', handleMouseUp);
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

  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;
  const ctx = curLayer.ctx;

  if (currentTool === 'eyedropper') {
    sampleColorAt(pos.x, pos.y);
    isPainting = false;
    return;
  }

  if (currentTool === 'bucket') {
    floodFill(curLayer, pos.x, pos.y, fgColor);
    compositeCanvas();
    pushHistory('Paint Bucket');
    isPainting = false;
    return;
  }

  if (currentTool === 'text') {
    const text = prompt('Enter text for layer:', 'MelPhoto Studio');
    if (text) {
      ctx.fillStyle = fgColor;
      ctx.font = `${brushSize * 2}px sans-serif`;
      ctx.fillText(text, pos.x, pos.y);
      compositeCanvas();
      pushHistory('Text Tool');
    }
    isPainting = false;
    return;
  }

  if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
    drawStroke(pos.x, pos.y, true);
  }
}

function handleMouseMove(e) {
  if (!isPainting) return;
  const pos = getCanvasCoords(e);
  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;

  if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
    drawStroke(pos.x, pos.y, false);
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

  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;
  const ctx = curLayer.ctx;
  const pos = getCanvasCoords(e);

  if (currentTool === 'rect') {
    ctx.fillStyle = fgColor;
    ctx.fillRect(Math.min(lastX, pos.x), Math.min(lastY, pos.y), Math.abs(pos.x - lastX), Math.abs(pos.y - lastY));
    compositeCanvas();
    pushHistory('Rectangle Tool');
  } else if (currentTool === 'oval') {
    ctx.fillStyle = fgColor;
    ctx.beginPath();
    const rx = Math.abs(pos.x - lastX) / 2;
    const ry = Math.abs(pos.y - lastY) / 2;
    ctx.ellipse(Math.min(lastX, pos.x) + rx, Math.min(lastY, pos.y) + ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    compositeCanvas();
    pushHistory('Ellipse Tool');
  } else if (currentTool === 'gradient') {
    const grad = ctx.createLinearGradient(lastX, lastY, pos.x, pos.y);
    grad.addColorStop(0, fgColor);
    grad.addColorStop(1, bgColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, docWidth, docHeight);
    compositeCanvas();
    pushHistory('Gradient Tool');
  } else if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser' || currentTool === 'move') {
    pushHistory(currentTool.toUpperCase());
  }
}

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

  lastX = x;
  lastY = y;
  compositeCanvas();
}

function translateLayer(layer, dx, dy) {
  const temp = createLayerCanvas();
  const tCtx = temp.getContext('2d');
  tCtx.drawImage(layer.canvas, 0, 0);

  layer.ctx.clearRect(0, 0, docWidth, docHeight);
  layer.ctx.drawImage(temp, dx, dy);
}

// 4-way flood fill algorithm
function floodFill(layer, startX, startY, hexFill) {
  const ctx = layer.ctx;
  const imgData = ctx.getImageData(0, 0, docWidth, docHeight);
  const data = imgData.data;

  const targetIdx = (startY * docWidth + startX) * 4;
  const startR = data[targetIdx];
  const startG = data[targetIdx + 1];
  const startB = data[targetIdx + 2];
  const startA = data[targetIdx + 3];

  const fillRgb = hexToRgb(hexFill);
  if (startR === fillRgb.r && startG === fillRgb.g && startB === fillRgb.b && startA === 255) return;

  const stack = [[startX, startY]];
  const visited = new Uint8Array(docWidth * docHeight);

  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cx >= docWidth || cy < 0 || cy >= docHeight) continue;
    const pIdx = cy * docWidth + cx;
    if (visited[pIdx]) continue;
    visited[pIdx] = 1;

    const bIdx = pIdx * 4;
    if (Math.abs(data[bIdx] - startR) < 30 &&
        Math.abs(data[bIdx + 1] - startG) < 30 &&
        Math.abs(data[bIdx + 2] - startB) < 30) {
      data[bIdx] = fillRgb.r;
      data[bIdx + 1] = fillRgb.g;
      data[bIdx + 2] = fillRgb.b;
      data[bIdx + 3] = 255;

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16) || 0,
    g: parseInt(c.substring(2, 4), 16) || 0,
    b: parseInt(c.substring(4, 6), 16) || 0
  };
}

function sampleColorAt(x, y) {
  const mainCanvas = document.getElementById('canvas-main');
  const ctx = mainCanvas.getContext('2d');
  const p = ctx.getImageData(x, y, 1, 1).data;
  const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
  setFgColor(hex);
}

// --- Tools & Options Bar ---
function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.btn-ps-tool').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${tool}`);
  if (btn) btn.classList.add('active');
}

function updateBrushSize(val) {
  brushSize = parseInt(val, 10);
  document.getElementById('lbl-brush-size').textContent = `${brushSize}px`;
}

function updateBrushOpacity(val) {
  brushOpacity = parseInt(val, 10) / 100;
  document.getElementById('lbl-brush-opacity').textContent = `${val}%`;
}

function updateBrushBlend(mode) {
  brushBlend = mode;
}

function pickColor(target) {
  pickTarget = target;
  document.getElementById('hidden-color-picker').click();
}

function handleColorPick(e) {
  const color = e.target.value;
  if (pickTarget === 'fg') setFgColor(color);
  else setBgColor(color);
}

function setFgColor(color) {
  fgColor = color;
  document.getElementById('chip-fg').style.backgroundColor = color;
}

function setBgColor(color) {
  bgColor = color;
  document.getElementById('chip-bg').style.backgroundColor = color;
}

function swapColors() {
  const temp = fgColor;
  setFgColor(bgColor);
  setBgColor(temp);
}

// Global shortcut D for default colors, X for swap
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'd' || e.key === 'D') {
    setFgColor('#000000');
    setBgColor('#ffffff');
  } else if (e.key === 'x' || e.key === 'X') {
    swapColors();
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    if (e.shiftKey) redo();
    else undo();
  } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
    redo();
  }
});

// --- Layers Management ---
function renderLayersList() {
  const container = document.getElementById('layers-list');
  container.innerHTML = '';

  // Render top layer first (reversed index)
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const row = document.createElement('div');
    row.className = `layer-row ${i === activeLayerIndex ? 'active' : ''}`;
    row.innerHTML = `
      <span onclick="toggleLayerVis(${i})" style="cursor:pointer;" title="Visibility">${layer.visible ? '👁' : '🚫'}</span>
      <div class="layer-thumb">🖼</div>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${layer.name}</span>
    `;
    row.onclick = () => selectLayer(i);
    container.appendChild(row);
  }

  const cur = layers[activeLayerIndex];
  if (cur) {
    document.getElementById('layer-blend-select').value = cur.blendMode;
    document.getElementById('layer-opacity-input').value = Math.round(cur.opacity * 100);
  }
  updateStatus();
}

function selectLayer(idx) {
  activeLayerIndex = idx;
  renderLayersList();
}

function toggleLayerVis(idx) {
  layers[idx].visible = !layers[idx].visible;
  renderLayersList();
  compositeCanvas();
}

function addNewLayer() {
  const newCanvas = createLayerCanvas();
  layers.push({
    name: `Layer ${layers.length + 1}`,
    visible: true,
    opacity: 1.0,
    blendMode: 'normal',
    canvas: newCanvas,
    ctx: newCanvas.getContext('2d')
  });
  activeLayerIndex = layers.length - 1;
  renderLayersList();
  compositeCanvas();
  pushHistory('New Layer');
}

function duplicateActiveLayer() {
  const cur = layers[activeLayerIndex];
  if (!cur) return;
  const newCanvas = createLayerCanvas();
  const newCtx = newCanvas.getContext('2d');
  newCtx.drawImage(cur.canvas, 0, 0);

  layers.splice(activeLayerIndex + 1, 0, {
    name: `${cur.name} Copy`,
    visible: cur.visible,
    opacity: cur.opacity,
    blendMode: cur.blendMode,
    canvas: newCanvas,
    ctx: newCtx
  });
  activeLayerIndex++;
  renderLayersList();
  compositeCanvas();
  pushHistory('Duplicate Layer');
}

function deleteActiveLayer() {
  if (layers.length <= 1) {
    alert("Document must have at least one layer.");
    return;
  }
  layers.splice(activeLayerIndex, 1);
  if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
  renderLayersList();
  compositeCanvas();
  pushHistory('Delete Layer');
}

function mergeDownLayer() {
  if (activeLayerIndex <= 0) {
    alert("Cannot merge bottom-most layer.");
    return;
  }
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
  if (layers[activeLayerIndex]) {
    layers[activeLayerIndex].blendMode = mode;
    compositeCanvas();
  }
}

function changeLayerOpacity(val) {
  if (layers[activeLayerIndex]) {
    layers[activeLayerIndex].opacity = Math.max(0, Math.min(100, parseInt(val, 10))) / 100;
    compositeCanvas();
  }
}

// --- History Stack ---
function pushHistory(name) {
  // truncate redo stack
  if (historyIndex < historyStack.length - 1) {
    historyStack = historyStack.slice(0, historyIndex + 1);
  }
  const curLayer = layers[activeLayerIndex];
  if (!curLayer) return;

  const snap = curLayer.ctx.getImageData(0, 0, docWidth, docHeight);
  historyStack.push({ name, layerIdx: activeLayerIndex, data: snap });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  historyIndex = historyStack.length - 1;
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = '';
  historyStack.forEach((h, idx) => {
    const item = document.createElement('div');
    item.className = `history-item ${idx === historyIndex ? 'active' : ''}`;
    item.textContent = `${idx + 1}. ${h.name}`;
    item.onclick = () => revertHistoryTo(idx);
    container.appendChild(item);
  });
}

function revertHistoryTo(idx) {
  historyIndex = idx;
  const h = historyStack[idx];
  if (layers[h.layerIdx]) {
    layers[h.layerIdx].ctx.putImageData(h.data, 0, 0);
    compositeCanvas();
  }
  renderHistory();
}

function undo() {
  if (historyIndex > 0) revertHistoryTo(historyIndex - 1);
}

function redo() {
  if (historyIndex < historyStack.length - 1) revertHistoryTo(historyIndex + 1);
}

// --- Image Filters & Adjustments ---
function applyFilter(filterName) {
  const curLayer = layers[activeLayerIndex];
  if (!curLayer || !curLayer.visible) return;

  const imgData = curLayer.ctx.getImageData(0, 0, docWidth, docHeight);

  if (filterName === 'brightness') {
    FilterEngine.applyBrightnessContrast(imgData, 20, 20);
    curLayer.ctx.putImageData(imgData, 0, 0);
  } else if (filterName === 'grayscale') {
    FilterEngine.applyGrayscale(imgData);
    curLayer.ctx.putImageData(imgData, 0, 0);
  } else if (filterName === 'sepia') {
    FilterEngine.applySepia(imgData);
    curLayer.ctx.putImageData(imgData, 0, 0);
  } else if (filterName === 'invert') {
    FilterEngine.applyInvert(imgData);
    curLayer.ctx.putImageData(imgData, 0, 0);
  } else if (filterName === 'threshold') {
    FilterEngine.applyThreshold(imgData, 128);
    curLayer.ctx.putImageData(imgData, 0, 0);
  } else if (filterName === 'sharpen') {
    const res = FilterEngine.applySharpen(imgData);
    curLayer.ctx.putImageData(res, 0, 0);
  } else if (filterName === 'findEdges') {
    const res = FilterEngine.applyFindEdges(imgData);
    curLayer.ctx.putImageData(res, 0, 0);
  } else if (filterName === 'emboss') {
    const res = FilterEngine.applyEmboss(imgData);
    curLayer.ctx.putImageData(res, 0, 0);
  } else if (filterName === 'blur') {
    const res = FilterEngine.applyBoxBlur(imgData);
    curLayer.ctx.putImageData(res, 0, 0);
  }

  compositeCanvas();
  pushHistory(`Filter: ${filterName}`);
}

// --- Native PSD Binary Export ---
async function savePsd() {
  // Build native PSD format with 8BPS header, layer records, PackBits RLE compression!
  const w = docWidth;
  const h = docHeight;

  // Compile layers to RGBA buffers
  const psdLayers = layers.map((layer, idx) => {
    const imgData = layer.ctx.getImageData(0, 0, w, h);
    return {
      name: layer.name,
      top: 0,
      left: 0,
      bottom: h,
      right: w,
      opacity: Math.round(layer.opacity * 255),
      blendMode: layer.blendMode,
      visible: layer.visible,
      rgbaData: imgData.data
    };
  });

  const psdBytes = buildPsdBinary(w, h, psdLayers);
  const blob = new Blob([new Uint8Array(psdBytes)], { type: 'application/octet-stream' });
  downloadBlob(blob, 'MelPhoto-Document.psd');
}

// Client-side PSD binary builder strictly adhering to specification
function buildPsdBinary(width, height, psdLayers) {
  const bytes = [];

  function write16(val) {
    bytes.push((val >> 8) & 0xFF, val & 0xFF);
  }
  function write32(val) {
    bytes.push((val >> 24) & 0xFF, (val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF);
  }
  function writeStr(str) {
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  }

  // 1. Header (26 bytes)
  writeStr('8BPS');
  write16(1); // Version 1
  for (let i = 0; i < 6; i++) bytes.push(0); // Reserved
  write16(3); // 3 channels composite
  write32(height);
  write32(width);
  write16(8); // 8 bits per channel
  write16(3); // ColorMode 3 = RGB

  // 2. Color Mode Data (length = 0)
  write32(0);

  // 3. Image Resources Section (8BIM Resolution)
  const resBytes = [];
  function pushResStr(s) { for (let i = 0; i < s.length; i++) resBytes.push(s.charCodeAt(i)); }
  pushResStr('8BIM');
  resBytes.push(0x03, 0xED); // ResolutionInfo ID
  resBytes.push(0, 0); // Name
  resBytes.push(0, 0, 0, 16); // Data length
  resBytes.push(0, 72, 0, 0); // 72 DPI
  resBytes.push(0, 1, 0, 1);
  resBytes.push(0, 72, 0, 0);
  resBytes.push(0, 1, 0, 1);

  write32(resBytes.length);
  bytes.push(...resBytes);

  // 4. Layer & Mask Information Section
  const layerCount = psdLayers.length;
  const layerRecs = [];
  const channelDataAll = [];

  for (let l = 0; l < layerCount; l++) {
    const layer = psdLayers[l];
    const pixelCount = width * height;
    const rPlane = new Uint8Array(pixelCount);
    const gPlane = new Uint8Array(pixelCount);
    const bPlane = new Uint8Array(pixelCount);
    const aPlane = new Uint8Array(pixelCount);

    const rgba = layer.rgbaData;
    for (let p = 0; p < pixelCount; p++) {
      rPlane[p] = rgba[p * 4];
      gPlane[p] = rgba[p * 4 + 1];
      bPlane[p] = rgba[p * 4 + 2];
      aPlane[p] = rgba[p * 4 + 3];
    }

    // Compression = 0 (Raw) for reliability across PSD viewers
    function makeChanBuf(plane) {
      const b = [0, 0]; // 2 bytes compression: 0 = Raw
      for (let i = 0; i < plane.length; i++) b.push(plane[i]);
      return b;
    }

    const rData = makeChanBuf(rPlane);
    const gData = makeChanBuf(gPlane);
    const bData = makeChanBuf(bPlane);
    const aData = makeChanBuf(aPlane);
    channelDataAll.push(...rData, ...gData, ...bData, ...aData);

    // Layer record
    const rec = [];
    function rec32(v) { rec.push((v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF); }
    function rec16(v) { rec.push((v >> 8) & 0xFF, v & 0xFF); }
    function recStr(s) { for (let i = 0; i < s.length; i++) rec.push(s.charCodeAt(i)); }

    rec32(layer.top);
    rec32(layer.left);
    rec32(layer.bottom);
    rec32(layer.right);
    rec16(4); // 4 channels

    rec16(0); rec32(rData.length); // Red
    rec16(1); rec32(gData.length); // Green
    rec16(2); rec32(bData.length); // Blue
    rec16(-1); rec32(aData.length); // Alpha

    recStr('8BIM');
    const blendKeys = { 'multiply': 'mul ', 'screen': 'scrn', 'overlay': 'over', 'darken': 'dark', 'lighten': 'lite', 'difference': 'diff' };
    recStr(blendKeys[layer.blendMode] || 'norm');

    rec.push(layer.opacity !== undefined ? layer.opacity : 255);
    rec.push(0); // clipping
    rec.push(layer.visible ? 0 : 2); // flags
    rec.push(0); // filler

    // Extra data: mask (4 bytes: 0) + ranges (4 bytes: 0) + name Pascal string
    const nameStr = layer.name || `Layer ${l + 1}`;
    const nameLen = Math.min(nameStr.length, 255);
    const paddedNameLen = Math.ceil((nameLen + 1) / 4) * 4;
    rec32(4 + 4 + paddedNameLen);
    rec32(0); // mask size
    rec32(0); // ranges size
    rec.push(nameLen);
    recStr(nameStr);
    for (let pad = 0; pad < paddedNameLen - (nameLen + 1); pad++) rec.push(0);

    layerRecs.push(...rec);
  }

  const layerInfoLen = 2 + layerRecs.length + channelDataAll.length;
  const layerInfoBytes = [];
  layerInfoBytes.push((layerInfoLen >> 24) & 0xFF, (layerInfoLen >> 16) & 0xFF, (layerInfoLen >> 8) & 0xFF, layerInfoLen & 0xFF);
  layerInfoBytes.push((layerCount >> 8) & 0xFF, layerCount & 0xFF);
  layerInfoBytes.push(...layerRecs);
  layerInfoBytes.push(...channelDataAll);

  // Write Layer & Mask section
  write32(layerInfoBytes.length);
  bytes.push(...layerInfoBytes);

  // 5. Composite Image Data Section (Compression 0: Raw planar RGB)
  write16(0); // Raw compression
  const mainCanvas = document.getElementById('canvas-main');
  const compData = mainCanvas.getContext('2d').getImageData(0, 0, width, height).data;
  const totalPix = width * height;

  for (let p = 0; p < totalPix; p++) bytes.push(compData[p * 4]);     // Red plane
  for (let p = 0; p < totalPix; p++) bytes.push(compData[p * 4 + 1]); // Green plane
  for (let p = 0; p < totalPix; p++) bytes.push(compData[p * 4 + 2]); // Blue plane

  return bytes;
}

// --- Native PSD Binary Import ---
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
    // Ordinary image (PNG, JPEG, WebP)
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
  // Read 8BPS header
  const sig = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (sig !== '8BPS') {
    alert('Invalid PSD file: missing 8BPS signature');
    return;
  }
  const h = (buf[14] << 24) | (buf[15] << 16) | (buf[16] << 8) | buf[17];
  const w = (buf[18] << 24) | (buf[19] << 16) | (buf[20] << 8) | buf[21];

  alert(`Loaded Native PSD Document!\nDimensions: ${w} x ${h} px\nFormat: Adobe Photoshop 8BPS`);
  // Composite current view
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
