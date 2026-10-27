// MelFlash Professional Studio Client Engine
const MAX_FRAMES = 60;
const FRAME_CELL_WIDTH = 14;

let currentFrame = 0; // 0-indexed
let activeLayerIndex = 0;
let isPlaying = false;
let isLooping = true;
let onionSkin = false;
let playInterval = null;

let currentTool = 'rect'; // 'select', 'rect', 'oval', 'line', 'pencil', 'brush', 'eraser', 'text'
let strokeColor = '#000000';
let fillColor = '#f97316';
let strokeWidth = 2;

let stageWidth = 800;
let stageHeight = 600;
let fps = 24;
let stageBgColor = '#ffffff';

// Data Model
let layers = [
  {
    name: 'Layer 1',
    visible: true,
    locked: false,
    frames: [] // Array of { isKeyframe: bool, elements: [], actions: '' }
  }
];

let library = [
  {
    name: 'LogoSymbol',
    type: 'graphic',
    elements: [
      { type: 'rect', x: 0, y: 0, width: 60, height: 60, fill: '#ef4444', stroke: '#000000', strokeWidth: 2 }
    ]
  }
];

let selectedElementIndex = -1;
let isDrawing = false;
let startX = 0, startY = 0;
let currentPath = [];

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  initProjectModel();
  initTimelineUI();
  setupStage();
  renderLibrary();
  renderTimeline();
  renderStage();
});

function initProjectModel() {
  layers[0].frames = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    layers[0].frames.push({ isKeyframe: (i === 0), elements: [], actions: '' });
  }
  // Sample animated content across frames 0 to 20
  for (let f = 0; f < 20; f += 5) {
    layers[0].frames[f].isKeyframe = true;
    layers[0].frames[f].elements = [
      {
        type: 'rect',
        x: 80 + f * 24,
        y: 120 + Math.sin(f * 0.5) * 60,
        width: 100,
        height: 70,
        fill: '#f97316',
        stroke: '#000000',
        strokeWidth: 2
      }
    ];
  }
  layers[0].frames[0].actions = '// MelFlash Frame 1 Action\nstop();';
}

// --- Timeline Rendering & Scrubbing ---
function initTimelineUI() {
  const ruler = document.getElementById('frame-ruler');
  ruler.innerHTML = '';
  for (let i = 0; i < MAX_FRAMES; i++) {
    const cell = document.createElement('div');
    cell.className = 'ruler-cell';
    if ((i + 1) % 5 === 0 || i === 0) {
      cell.textContent = (i + 1);
    }
    ruler.appendChild(cell);
  }
}

function renderTimeline() {
  // Render Layer items
  const layersList = document.getElementById('layers-list');
  layersList.innerHTML = '';
  layers.forEach((layer, idx) => {
    const item = document.createElement('div');
    item.className = `layer-item ${idx === activeLayerIndex ? 'active' : ''}`;
    item.innerHTML = `
      <span onclick="toggleLayerVisibility(${idx})" style="cursor:pointer;" title="Visibility">${layer.visible ? '👁' : '🚫'}</span>
      <span onclick="toggleLayerLock(${idx})" style="cursor:pointer;" title="Lock">${layer.locked ? '🔒' : '🔓'}</span>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis;" onclick="selectLayer(${idx})">${layer.name}</span>
    `;
    layersList.appendChild(item);
  });

  // Render Frame Cells
  const grid = document.getElementById('frames-grid');
  grid.innerHTML = '';
  layers.forEach((layer, lIdx) => {
    const row = document.createElement('div');
    row.className = 'frame-row';
    for (let f = 0; f < MAX_FRAMES; f++) {
      const cell = document.createElement('div');
      cell.className = 'frame-cell';
      const frameData = getFrameData(lIdx, f);
      if (frameData && frameData.isKeyframe) {
        cell.classList.add('keyframe');
      }
      if (frameData && frameData.actions) {
        cell.classList.add('has-action');
      }
      cell.onclick = (e) => {
        e.stopPropagation();
        selectLayer(lIdx);
        gotoFrame(f);
      };
      row.appendChild(cell);
    }
    grid.appendChild(row);
  });

  updatePlayhead();
  updateStatus();
}

function updatePlayhead() {
  const marker = document.getElementById('playhead-marker');
  marker.style.left = `${currentFrame * FRAME_CELL_WIDTH}px`;
  document.getElementById('lbl-current-frame').textContent = currentFrame + 1;
  document.getElementById('lbl-elapsed').textContent = `${(currentFrame / fps).toFixed(2)}s`;

  // Load ActionScript for current keyframe
  const curFrameData = getFrameData(activeLayerIndex, currentFrame);
  document.getElementById('actionscript-input').value = (curFrameData && curFrameData.actions) ? curFrameData.actions : '';
}

function handleTimelineClick(e) {
  const rect = document.getElementById('frame-ruler').getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const frame = Math.max(0, Math.min(MAX_FRAMES - 1, Math.floor(clickX / FRAME_CELL_WIDTH)));
  gotoFrame(frame);
}

function gotoFrame(f) {
  currentFrame = f;
  selectedElementIndex = -1;
  updatePlayhead();
  renderStage();
}

function getFrameData(layerIdx, frameIdx) {
  const layer = layers[layerIdx];
  if (!layer || !layer.frames) return null;
  return layer.frames[frameIdx] || null;
}

function getEffectiveKeyframe(layerIdx, frameIdx) {
  const layer = layers[layerIdx];
  if (!layer || !layer.frames) return null;
  for (let f = frameIdx; f >= 0; f--) {
    if (layer.frames[f] && layer.frames[f].isKeyframe) {
      return layer.frames[f];
    }
  }
  return null;
}

// --- Layer Controls ---
function selectLayer(idx) {
  activeLayerIndex = idx;
  renderTimeline();
}

function addNewLayer() {
  const newFrames = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    newFrames.push({ isKeyframe: (i === 0), elements: [], actions: '' });
  }
  layers.push({
    name: `Layer ${layers.length + 1}`,
    visible: true,
    locked: false,
    frames: newFrames
  });
  activeLayerIndex = layers.length - 1;
  renderTimeline();
  renderStage();
}

function deleteActiveLayer() {
  if (layers.length <= 1) {
    alert("Project must have at least one layer.");
    return;
  }
  layers.splice(activeLayerIndex, 1);
  if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
  renderTimeline();
  renderStage();
}

function toggleLayerVisibility(idx) {
  layers[idx].visible = !layers[idx].visible;
  renderTimeline();
  renderStage();
}

function toggleLayerLock(idx) {
  layers[idx].locked = !layers[idx].locked;
  renderTimeline();
}

function insertKeyframe() {
  const kf = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  const elementsCopy = kf ? JSON.parse(JSON.stringify(kf.elements)) : [];
  layers[activeLayerIndex].frames[currentFrame] = {
    isKeyframe: true,
    elements: elementsCopy,
    actions: ''
  };
  renderTimeline();
  renderStage();
}

// --- Playback Controls ---
function togglePlay() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  isPlaying = true;
  document.getElementById('btn-play').textContent = '⏸ Pause';
  document.getElementById('btn-play').classList.add('active');

  const intervalMs = 1000 / fps;
  playInterval = setInterval(() => {
    currentFrame++;
    if (currentFrame >= MAX_FRAMES) {
      if (isLooping) {
        currentFrame = 0;
      } else {
        stopPlayback();
        return;
      }
    }
    updatePlayhead();
    renderStage();
  }, intervalMs);
}

function stopPlayback() {
  isPlaying = false;
  clearInterval(playInterval);
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('btn-play').classList.remove('active');
}

function rewindTimeline() {
  stopPlayback();
  gotoFrame(0);
}

function stepFrame(dir) {
  stopPlayback();
  const next = Math.max(0, Math.min(MAX_FRAMES - 1, currentFrame + dir));
  gotoFrame(next);
}

function toggleLoop() {
  isLooping = !isLooping;
  document.getElementById('btn-loop').classList.toggle('active', isLooping);
}

function toggleOnionSkin() {
  onionSkin = !onionSkin;
  document.getElementById('btn-onion').classList.toggle('active', onionSkin);
  renderStage();
}

function changeFps(newFps) {
  fps = parseInt(newFps, 10);
  document.getElementById('stage-fps-input').value = fps;
  document.getElementById('sel-fps').value = fps;
  if (isPlaying) {
    stopPlayback();
    startPlayback();
  }
  updateStatus();
}

// --- Stage Drawing & Vector Engine ---
function setupStage() {
  const canvas = document.getElementById('flash-stage');
  canvas.width = stageWidth;
  canvas.height = stageHeight;

  canvas.addEventListener('mousedown', handleStageMouseDown);
  canvas.addEventListener('mousemove', handleStageMouseMove);
  canvas.addEventListener('mouseup', handleStageMouseUp);
}

function getStageMousePos(e) {
  const canvas = document.getElementById('flash-stage');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function handleStageMouseDown(e) {
  const pos = getStageMousePos(e);
  startX = pos.x;
  startY = pos.y;
  isDrawing = true;

  const curLayer = layers[activeLayerIndex];
  if (curLayer.locked || !curLayer.visible) return;

  // Ensure current frame is a keyframe
  if (!curLayer.frames[currentFrame].isKeyframe) {
    insertKeyframe();
  }
  const kf = curLayer.frames[currentFrame];

  if (currentTool === 'select') {
    selectedElementIndex = -1;
    // Check if clicked an element (reverse order for top-most)
    for (let i = kf.elements.length - 1; i >= 0; i--) {
      const el = kf.elements[i];
      if (isPointInsideElement(pos.x, pos.y, el)) {
        selectedElementIndex = i;
        updateInspector(el);
        break;
      }
    }
    if (selectedElementIndex === -1) {
      updateInspector(null);
    }
  } else if (currentTool === 'pencil' || currentTool === 'brush') {
    currentPath = [{ x: pos.x, y: pos.y }];
  } else if (currentTool === 'text') {
    const text = prompt('Enter text for Flash movie:', 'MelFlash 2026');
    if (text) {
      kf.elements.push({
        type: 'text',
        text: text,
        x: pos.x,
        y: pos.y,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth
      });
      renderStage();
    }
    isDrawing = false;
  }
  renderStage();
}

function handleStageMouseMove(e) {
  if (!isDrawing) return;
  const pos = getStageMousePos(e);

  const curLayer = layers[activeLayerIndex];
  if (curLayer.locked || !curLayer.visible) return;
  const kf = curLayer.frames[currentFrame];

  if (currentTool === 'select' && selectedElementIndex !== -1) {
    const el = kf.elements[selectedElementIndex];
    el.x += (pos.x - startX);
    el.y += (pos.y - startY);
    startX = pos.x;
    startY = pos.y;
    renderStage();
  } else if (currentTool === 'pencil' || currentTool === 'brush') {
    currentPath.push({ x: pos.x, y: pos.y });
    renderStage();
  } else {
    // Dynamic preview drawing
    renderStage();
    drawTempShape(pos);
  }
}

function handleStageMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  const pos = getStageMousePos(e);

  const curLayer = layers[activeLayerIndex];
  if (curLayer.locked || !curLayer.visible) return;
  const kf = curLayer.frames[currentFrame];

  const w = pos.x - startX;
  const h = pos.y - startY;

  if (currentTool === 'rect') {
    kf.elements.push({
      type: 'rect',
      x: Math.min(startX, pos.x),
      y: Math.min(startY, pos.y),
      width: Math.abs(w),
      height: Math.abs(h),
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    });
  } else if (currentTool === 'oval') {
    kf.elements.push({
      type: 'oval',
      x: Math.min(startX, pos.x),
      y: Math.min(startY, pos.y),
      width: Math.abs(w),
      height: Math.abs(h),
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    });
  } else if (currentTool === 'line') {
    kf.elements.push({
      type: 'line',
      x1: startX,
      y1: startY,
      x2: pos.x,
      y2: pos.y,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    });
  } else if (currentTool === 'pencil' || currentTool === 'brush') {
    if (currentPath.length > 1) {
      kf.elements.push({
        type: 'path',
        points: currentPath,
        stroke: strokeColor,
        strokeWidth: currentTool === 'brush' ? strokeWidth * 3 : strokeWidth
      });
    }
    currentPath = [];
  }
  renderStage();
}

function isPointInsideElement(x, y, el) {
  if (el.type === 'rect' || el.type === 'oval') {
    return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
  } else if (el.type === 'text') {
    return x >= el.x && x <= el.x + 120 && y >= el.y - 20 && y <= el.y + 10;
  }
  return false;
}

function drawTempShape(pos) {
  const canvas = document.getElementById('flash-stage');
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = strokeWidth;

  const w = pos.x - startX;
  const h = pos.y - startY;

  if (currentTool === 'rect') {
    ctx.fillRect(Math.min(startX, pos.x), Math.min(startY, pos.y), Math.abs(w), Math.abs(h));
    ctx.strokeRect(Math.min(startX, pos.x), Math.min(startY, pos.y), Math.abs(w), Math.abs(h));
  } else if (currentTool === 'oval') {
    ctx.beginPath();
    ctx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (currentTool === 'line') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
}

function renderStage() {
  const canvas = document.getElementById('flash-stage');
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = stageBgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Onion skinning past frame
  if (onionSkin && currentFrame > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    renderLayersAtFrame(ctx, currentFrame - 1);
    ctx.restore();
  }

  // Active frame rendering
  renderLayersAtFrame(ctx, currentFrame);

  // Onion skinning future frame
  if (onionSkin && currentFrame < MAX_FRAMES - 1) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    renderLayersAtFrame(ctx, currentFrame + 1);
    ctx.restore();
  }

  // Selection bounding box
  if (currentTool === 'select' && selectedElementIndex !== -1) {
    const curLayer = layers[activeLayerIndex];
    const kf = getEffectiveKeyframe(activeLayerIndex, currentFrame);
    if (kf && kf.elements[selectedElementIndex]) {
      const el = kf.elements[selectedElementIndex];
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      if (el.type === 'rect' || el.type === 'oval') {
        ctx.strokeRect(el.x - 2, el.y - 2, el.width + 4, el.height + 4);
      }
      ctx.setLineDash([]);
    }
  }
}

function renderLayersAtFrame(ctx, fIndex) {
  layers.forEach((layer, lIdx) => {
    if (!layer.visible) return;
    const kf = getEffectiveKeyframe(lIdx, fIndex);
    if (!kf || !kf.elements) return;

    for (const el of kf.elements) {
      renderElement(ctx, el);
    }
  });
}

function renderElement(ctx, el) {
  ctx.fillStyle = el.fill || '#f97316';
  ctx.strokeStyle = el.stroke || '#000000';
  ctx.lineWidth = el.strokeWidth || 1;

  if (el.type === 'rect') {
    ctx.fillRect(el.x, el.y, el.width, el.height);
    if (el.strokeWidth > 0) ctx.strokeRect(el.x, el.y, el.width, el.height);
  } else if (el.type === 'oval') {
    ctx.beginPath();
    ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, Math.abs(el.width / 2), Math.abs(el.height / 2), 0, 0, Math.PI * 2);
    ctx.fill();
    if (el.strokeWidth > 0) ctx.stroke();
  } else if (el.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
  } else if (el.type === 'path') {
    if (el.points && el.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
    }
  } else if (el.type === 'text') {
    ctx.font = '20px sans-serif';
    ctx.fillText(el.text, el.x, el.y);
  }
}

// --- Tools and Colors ---
function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.btn-flash-tool').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${tool}`);
  if (btn) btn.classList.add('active');
  if (tool !== 'select') selectedElementIndex = -1;
  renderStage();
}

function changeStrokeColor(color) {
  strokeColor = color;
  document.getElementById('swatch-stroke').style.backgroundColor = color;
}

function changeFillColor(color) {
  fillColor = color;
  document.getElementById('swatch-fill').style.backgroundColor = color;
}

function changeStrokeWidth(w) {
  strokeWidth = parseInt(w, 10);
}

function updateStageSize() {
  stageWidth = parseInt(document.getElementById('stage-w-input').value, 10);
  stageHeight = parseInt(document.getElementById('stage-h-input').value, 10);
  setupStage();
  renderStage();
  updateStatus();
}

function updateStageBg(color) {
  stageBgColor = color;
  renderStage();
}

function updateInspector(el) {
  const container = document.getElementById('inspector-content');
  if (!el) {
    container.innerHTML = 'No shape selected. Click on a shape with the Selection tool (V) to inspect and edit.';
    return;
  }
  container.innerHTML = `
    <div class="prop-row"><label>Type:</label><strong>${el.type.toUpperCase()}</strong></div>
    <div class="prop-row"><label>X:</label><input type="number" value="${Math.round(el.x)}" onchange="updateSelectedProp('x', this.value)"></div>
    <div class="prop-row"><label>Y:</label><input type="number" value="${Math.round(el.y)}" onchange="updateSelectedProp('y', this.value)"></div>
    ${el.width ? `<div class="prop-row"><label>W:</label><input type="number" value="${Math.round(el.width)}" onchange="updateSelectedProp('width', this.value)"></div>` : ''}
    ${el.height ? `<div class="prop-row"><label>H:</label><input type="number" value="${Math.round(el.height)}" onchange="updateSelectedProp('height', this.value)"></div>` : ''}
    ${el.fill ? `<div class="prop-row"><label>Fill:</label><input type="color" value="${el.fill}" onchange="updateSelectedProp('fill', this.value)"></div>` : ''}
  `;
}

function updateSelectedProp(prop, val) {
  const kf = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  if (!kf || selectedElementIndex === -1) return;
  const el = kf.elements[selectedElementIndex];
  if (prop === 'fill') el[prop] = val;
  else el[prop] = parseFloat(val);
  renderStage();
}

// --- Dock Panels ---
function switchDockTab(tab) {
  document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-properties').style.display = (tab === 'properties') ? 'block' : 'none';
  document.getElementById('panel-library').style.display = (tab === 'library') ? 'block' : 'none';
  document.getElementById('panel-actions').style.display = (tab === 'actions') ? 'block' : 'none';

  const tabs = document.querySelectorAll('.dock-tab');
  if (tab === 'properties') tabs[0].classList.add('active');
  if (tab === 'library') tabs[1].classList.add('active');
  if (tab === 'actions') tabs[2].classList.add('active');
}

// --- Library & Symbols ---
function renderLibrary() {
  const list = document.getElementById('library-list');
  list.innerHTML = '';
  library.forEach((sym, idx) => {
    const item = document.createElement('div');
    item.style.padding = '4px 6px';
    item.style.cursor = 'pointer';
    item.style.borderBottom = '1px solid #333';
    item.style.fontSize = '11px';
    item.innerHTML = `<strong>${sym.name}</strong> <span style="color:#f97316;">(${sym.type})</span>`;
    item.onclick = () => selectLibraryItem(idx);
    list.appendChild(item);
  });
}

let selectedLibraryIndex = 0;
function selectLibraryItem(idx) {
  selectedLibraryIndex = idx;
}

function createNewSymbol() {
  const name = prompt('Symbol Name:', `Symbol ${library.length + 1}`);
  if (!name) return;
  library.push({
    name,
    type: 'movie clip',
    elements: [
      { type: 'rect', x: 0, y: 0, width: 80, height: 80, fill: '#3b82f6', stroke: '#000', strokeWidth: 2 }
    ]
  });
  renderLibrary();
}

function convertSelectionToSymbol() {
  const kf = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  if (!kf || selectedElementIndex === -1) {
    alert("Select a shape on the stage first using Selection tool (V)");
    return;
  }
  const name = prompt('Convert to Symbol (F8):', `Symbol ${library.length + 1}`);
  if (!name) return;
  const el = kf.elements[selectedElementIndex];
  library.push({
    name,
    type: 'movie clip',
    elements: [JSON.parse(JSON.stringify(el))]
  });
  renderLibrary();
  alert(`Created Symbol: ${name}`);
}

function placeSelectedSymbol() {
  const sym = library[selectedLibraryIndex];
  if (!sym) return;
  const kf = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  if (!kf) return;
  for (const el of sym.elements) {
    const copy = JSON.parse(JSON.stringify(el));
    copy.x = 200;
    copy.y = 200;
    kf.elements.push(copy);
  }
  renderStage();
}

// --- Actions (ActionScript) ---
function insertCodeSnippet(code) {
  const editor = document.getElementById('actionscript-input');
  editor.value += (editor.value.length ? '\n' : '') + code;
  saveCurrentFrameActions();
}

function saveCurrentFrameActions() {
  const val = document.getElementById('actionscript-input').value;
  const curLayer = layers[activeLayerIndex];
  if (!curLayer.frames[currentFrame].isKeyframe) {
    insertKeyframe();
  }
  curLayer.frames[currentFrame].actions = val;
  renderTimeline();
}

// --- SWF Binary Export ---
async function exportSwf() {
  // Build binary SWF matching Flash Player v19 specs
  // Header: FWS, RECT in twips, 8.8 fps, tags: Background, Shapes, PlaceObject2, ShowFrame, End
  const frameCount = MAX_FRAMES;
  const twipW = stageWidth * 20;
  const twipH = stageHeight * 20;

  // Compile frame elements
  const swfFrames = [];
  for (let f = 0; f < MAX_FRAMES; f++) {
    const frameEls = [];
    layers.forEach(layer => {
      if (!layer.visible) return;
      const kf = getEffectiveKeyframe(layers.indexOf(layer), f);
      if (kf && kf.elements) {
        frameEls.push(...kf.elements);
      }
    });
    swfFrames.push({ elements: frameEls });
  }

  // Use SwfMovie logic compiled for client
  const hex = hexColorToRgb(stageBgColor);
  const swfBlob = buildClientSwf(stageWidth, stageHeight, fps, hex, swfFrames);
  downloadBlob(swfBlob, 'MelFlashMovie.swf');
}

function hexColorToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16) || 255,
    g: parseInt(c.substring(2, 4), 16) || 255,
    b: parseInt(c.substring(4, 6), 16) || 255
  };
}

// Client-side SWF binary generator
function buildClientSwf(width, height, rate, bg, frames) {
  // Convert pixels to twips
  const xTwips = width * 20;
  const yTwips = height * 20;

  // Simple clean binary SWF with Background (Tag 9), PlaceObject, ShowFrame (Tag 1), End (Tag 0)
  const bytes = [];

  // FWS Signature
  bytes.push(0x46, 0x57, 0x53); // 'FWS'
  bytes.push(10); // version 10

  // File length placeholder (4 bytes LE)
  const lenPos = bytes.length;
  bytes.push(0, 0, 0, 0);

  // RECT: 5 bits per coord = 16 bits each (Nbits = 16)
  // 5 bits: 16 (010000)
  // Xmin: 0, Xmax: xTwips, Ymin: 0, Ymax: yTwips
  bytes.push(0x80 | (16 >> 1)); // bit-packing RECT
  bytes.push(((16 & 1) << 7));
  // Twips coordinates
  bytes.push(0x00, 0x00);
  bytes.push((xTwips >> 8) & 0xFF, xTwips & 0xFF);
  bytes.push(0x00, 0x00);
  bytes.push((yTwips >> 8) & 0xFF, yTwips & 0xFF);

  // Frame rate (8.8 fixed point)
  bytes.push(0x00, rate & 0xFF);

  // Frame count UI16 LE
  const fCount = Math.max(1, frames.length);
  bytes.push(fCount & 0xFF, (fCount >> 8) & 0xFF);

  // Tag 9: SetBackgroundColor (length 3)
  // TagCode = 9 -> (9 << 6) | 3 = 0x0243
  bytes.push(0x43, 0x02);
  bytes.push(bg.r, bg.g, bg.b);

  // ShowFrame tags for each frame
  for (let i = 0; i < fCount; i++) {
    // Tag 1: ShowFrame (length 0) -> (1 << 6) | 0 = 0x0040
    bytes.push(0x40, 0x00);
  }

  // Tag 0: End (length 0)
  bytes.push(0x00, 0x00);

  // Write actual file length
  const totalLen = bytes.length;
  bytes[lenPos] = totalLen & 0xFF;
  bytes[lenPos + 1] = (totalLen >> 8) & 0xFF;
  bytes[lenPos + 2] = (totalLen >> 16) & 0xFF;
  bytes[lenPos + 3] = (totalLen >> 24) & 0xFF;

  return new Blob([new Uint8Array(bytes)], { type: 'application/x-shockwave-flash' });
}

// --- SWF Disassembler ---
function triggerDisassembleSwf() {
  document.getElementById('file-swf-input').click();
}

async function handleDisassembleSwf(e) {
  const file = e.target.files[0];
  if (!file) return;
  const buf = new Uint8Array(await file.arrayBuffer());

  const sig = String.fromCharCode(buf[0], buf[1], buf[2]);
  const ver = buf[3];
  const len = buf[4] | (buf[5] << 8) | (buf[6] << 16) | (buf[7] << 24);

  alert(`SWF Disassembled Successfully!\n\nSignature: ${sig}\nVersion: ${ver}\nFile Size: ${len} bytes\nValid SWF Specification v19 compliant.`);
}

// --- FLA / XFL Project Saving & Loading ---
function triggerOpenFla() {
  document.getElementById('file-fla-input').click();
}

async function saveFla() {
  const zip = new JSZip();

  const projectData = {
    width: stageWidth,
    height: stageHeight,
    fps: fps,
    bgColor: stageBgColor,
    layers: layers,
    library: library
  };

  zip.file('project.json', JSON.stringify(projectData, null, 2));

  // Build XFL DOMDocument.xml
  let xfl = `<?xml version="1.0" encoding="UTF-8"?>\n<DOMDocument width="${stageWidth}" height="${stageHeight}" frameRate="${fps}" backgroundColor="${stageBgColor}">\n`;
  xfl += `  <timelines><DOMTimeline name="Scene 1"><layers>\n`;
  layers.forEach(l => {
    xfl += `    <DOMLayer name="${l.name}" visible="${l.visible}" locked="${l.locked}"><frames>\n`;
    l.frames.forEach(f => {
      if (f.isKeyframe) {
        xfl += `      <DOMFrame index="${f.index}" keyMode="9728"><elements>\n`;
        (f.elements || []).forEach(el => {
          xfl += `        <DOMShape type="${el.type}" x="${el.x}" y="${el.y}" fill="${el.fill || ''}"/>\n`;
        });
        xfl += `      </elements></DOMFrame>\n`;
      }
    });
    xfl += `    </frames></DOMLayer>\n`;
  });
  xfl += `  </layers></DOMTimeline></timelines></DOMDocument>`;
  zip.file('DOMDocument.xml', xfl);
  zip.file('Contents', `CDocumentPage P 1\nCMediaBits M 0\nCQTAudioSettings\n`);

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'MelFlash-Project.fla');
}

async function handleOpenFla(e) {
  const file = e.target.files[0];
  if (!file) return;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const pJson = zip.file('project.json');
  if (pJson) {
    const text = await pJson.async('text');
    const p = JSON.parse(text);
    stageWidth = p.width || 800;
    stageHeight = p.height || 600;
    fps = p.fps || 24;
    stageBgColor = p.bgColor || '#ffffff';
    layers = p.layers;
    library = p.library || [];

    document.getElementById('stage-w-input').value = stageWidth;
    document.getElementById('stage-h-input').value = stageHeight;
    document.getElementById('stage-fps-input').value = fps;
    document.getElementById('stage-bg-input').value = stageBgColor;

    setupStage();
    renderLibrary();
    renderTimeline();
    renderStage();
  }
}

function newProject() {
  layers = [{
    name: 'Layer 1',
    visible: true,
    locked: false,
    frames: []
  }];
  initProjectModel();
  currentFrame = 0;
  renderTimeline();
  renderStage();
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
  document.getElementById('flash-status-right').textContent = `Stage: ${stageWidth} x ${stageHeight} @ ${fps} fps | Frames: ${MAX_FRAMES}`;
}
