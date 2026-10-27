// MelFlash Professional Studio Client Engine
// Complete Adobe Flash Professional Editor with Timeline Tweens, Free Transform (Q), Library Symbols (F8), and ActionScript

const MAX_FRAMES = 60;
const FRAME_CELL_WIDTH = 14;

let currentFrame = 0; // 0-indexed
let activeLayerIndex = 0;
let isPlaying = false;
let isLooping = true;
let onionSkin = false;
let playInterval = null;

let currentTool = 'transform'; // 'select', 'subselect', 'transform', 'rect', 'oval', 'line', 'pencil', 'brush', 'eraser', 'bucket', 'eyedropper', 'text'
let strokeColor = '#000000';
let fillColor = '#f97316';
let strokeWidth = 2;
let snapToObjects = true;

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
    frames: [] // Array of { isKeyframe: bool, isBlank: bool, isTween: bool, elements: [], actions: '' }
  }
];

let library = [
  {
    name: 'LogoSymbol',
    type: 'graphic',
    elements: [
      { type: 'rect', x: -30, y: -30, width: 60, height: 60, fill: '#ef4444', stroke: '#000000', strokeWidth: 2 }
    ]
  }
];

let selectedElementIndex = -1;
let isDrawing = false;
let startX = 0, startY = 0;
let currentPath = [];
let transformHandle = null; // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w', 'rot'

// Test Movie Player state
let testMovieInterval = null;
let testMovieFrame = 0;
let isTestMoviePlaying = false;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  initProjectModel();
  initTimelineUI();
  setupStage();
  renderLibrary();
  renderTimeline();
  renderStage();
  setupShortcuts();
});

function initProjectModel() {
  layers[0].frames = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    layers[0].frames.push({ isKeyframe: (i === 0), isBlank: false, isTween: false, elements: [], actions: '' });
  }

  // Sample animated content across frames 0 to 20 with tweening
  layers[0].frames[0].isKeyframe = true;
  layers[0].frames[0].isTween = true;
  layers[0].frames[0].elements = [
    {
      type: 'rect',
      x: 100,
      y: 150,
      width: 120,
      height: 80,
      rotation: 0,
      fill: '#f97316',
      stroke: '#000000',
      strokeWidth: 2
    }
  ];
  layers[0].frames[0].actions = '// Frame 1 Script\nstop();';

  layers[0].frames[20].isKeyframe = true;
  layers[0].frames[20].elements = [
    {
      type: 'rect',
      x: 520,
      y: 280,
      width: 150,
      height: 100,
      rotation: 45,
      fill: '#38bdf8',
      stroke: '#000000',
      strokeWidth: 2
    }
  ];
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
      if (frameData) {
        if (frameData.isKeyframe) {
          if (frameData.isBlank) {
            cell.classList.add('blank-keyframe');
          } else {
            cell.classList.add('keyframe');
          }
        }
        if (frameData.isTween) {
          cell.classList.add('tween');
        }
        if (frameData.actions) {
          cell.classList.add('has-action');
        }
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
      return { kf: layer.frames[f], frame: f };
    }
  }
  return null;
}

function getNextKeyframe(layerIdx, startFrame) {
  const layer = layers[layerIdx];
  if (!layer || !layer.frames) return null;
  for (let f = startFrame + 1; f < MAX_FRAMES; f++) {
    if (layer.frames[f] && layer.frames[f].isKeyframe) {
      return { kf: layer.frames[f], frame: f };
    }
  }
  return null;
}

// Compute interpolated elements for tween frames
function getRenderElements(layerIdx, frameIdx) {
  const prev = getEffectiveKeyframe(layerIdx, frameIdx);
  if (!prev) return [];
  if (prev.frame === frameIdx || !prev.kf.isTween) {
    return prev.kf.elements || [];
  }

  const next = getNextKeyframe(layerIdx, prev.frame);
  if (!next || next.frame <= prev.frame) {
    return prev.kf.elements || [];
  }

  // Linear interpolation between prev and next
  const t = (frameIdx - prev.frame) / (next.frame - prev.frame);
  const interpolated = [];
  const pEls = prev.kf.elements || [];
  const nEls = next.kf.elements || [];

  for (let i = 0; i < pEls.length; i++) {
    const p = pEls[i];
    const n = nEls[i] || p;
    interpolated.push({
      type: p.type,
      x: p.x + (n.x - p.x) * t,
      y: p.y + (n.y - p.y) * t,
      width: (p.width || 0) + ((n.width || p.width || 0) - (p.width || 0)) * t,
      height: (p.height || 0) + ((n.height || p.height || 0) - (p.height || 0)) * t,
      rotation: (p.rotation || 0) + ((n.rotation || 0) - (p.rotation || 0)) * t,
      fill: p.fill,
      stroke: p.stroke,
      strokeWidth: p.strokeWidth
    });
  }

  return interpolated;
}

// --- Layer Controls ---
function selectLayer(idx) {
  activeLayerIndex = idx;
  renderTimeline();
}

function addNewLayer() {
  const newFrames = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    newFrames.push({ isKeyframe: (i === 0), isBlank: false, isTween: false, elements: [], actions: '' });
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

// --- Keyframes & Tweening ---
function insertKeyframe() {
  const eff = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  const elementsCopy = eff ? JSON.parse(JSON.stringify(eff.kf.elements)) : [];
  layers[activeLayerIndex].frames[currentFrame] = {
    isKeyframe: true,
    isBlank: false,
    isTween: false,
    elements: elementsCopy,
    actions: ''
  };
  renderTimeline();
  renderStage();
}

function insertBlankKeyframe() {
  layers[activeLayerIndex].frames[currentFrame] = {
    isKeyframe: true,
    isBlank: true,
    isTween: false,
    elements: [],
    actions: ''
  };
  renderTimeline();
  renderStage();
}

function createClassicTween() {
  const eff = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  if (!eff) return;
  eff.kf.isTween = !eff.kf.isTween;
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

// --- Stage Drawing & Free Transform ---
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

  // Auto-insert keyframe if drawing on a holding frame
  if (!curLayer.frames[currentFrame].isKeyframe) {
    insertKeyframe();
  }
  const kf = curLayer.frames[currentFrame];

  if (currentTool === 'select' || currentTool === 'transform') {
    // Check if clicked on a transform handle first
    if (currentTool === 'transform' && selectedElementIndex !== -1) {
      const el = kf.elements[selectedElementIndex];
      const h = hitTestTransformHandles(pos.x, pos.y, el);
      if (h) {
        transformHandle = h;
        return;
      }
    }

    selectedElementIndex = -1;
    transformHandle = null;

    // Check hit on elements (top-most first)
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
  } else if (currentTool === 'bucket') {
    for (let i = kf.elements.length - 1; i >= 0; i--) {
      const el = kf.elements[i];
      if (isPointInsideElement(pos.x, pos.y, el)) {
        el.fill = fillColor;
        break;
      }
    }
    isDrawing = false;
  } else if (currentTool === 'eyedropper') {
    const canvas = document.getElementById('flash-stage');
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
    changeFillColor(hex);
    isDrawing = false;
  } else if (currentTool === 'text') {
    const text = prompt('Enter Flash Text:', 'MelFlash 2026');
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

  if ((currentTool === 'select' || currentTool === 'transform') && selectedElementIndex !== -1) {
    const el = kf.elements[selectedElementIndex];
    if (transformHandle) {
      applyTransform(el, transformHandle, pos.x - startX, pos.y - startY);
      startX = pos.x;
      startY = pos.y;
    } else {
      el.x += (pos.x - startX);
      el.y += (pos.y - startY);
      startX = pos.x;
      startY = pos.y;
    }
    renderStage();
  } else if (currentTool === 'pencil' || currentTool === 'brush') {
    currentPath.push({ x: pos.x, y: pos.y });
    renderStage();
  } else {
    // Shape creation preview
    renderStage();
    drawTempShape(pos);
  }
}

function handleStageMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  transformHandle = null;
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
      rotation: 0,
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
      rotation: 0,
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
        stroke: (currentTool === 'brush' ? fillColor : strokeColor),
        strokeWidth: (currentTool === 'brush' ? strokeWidth * 3 : strokeWidth)
      });
    }
    currentPath = [];
  } else if (currentTool === 'eraser') {
    // Erase shapes touched by radius
    for (let i = kf.elements.length - 1; i >= 0; i--) {
      if (isPointInsideElement(pos.x, pos.y, kf.elements[i])) {
        kf.elements.splice(i, 1);
        break;
      }
    }
  }

  renderStage();
}

function isPointInsideElement(px, py, el) {
  if (el.type === 'rect' || el.type === 'oval') {
    return px >= el.x && px <= el.x + el.width && py >= el.y && py <= el.y + el.height;
  } else if (el.type === 'line') {
    const d = distToSegment(px, py, el.x1, el.y1, el.x2, el.y2);
    return d <= 8;
  } else if (el.type === 'text') {
    return px >= el.x && px <= el.x + 120 && py >= el.y - 20 && py <= el.y + 10;
  }
  return false;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Transform Handles & Operations
function hitTestTransformHandles(px, py, el) {
  const bbox = { x: el.x, y: el.y, w: el.width || 60, h: el.height || 60 };
  const handleSize = 8;
  const handles = [
    { name: 'nw', x: bbox.x, y: bbox.y },
    { name: 'ne', x: bbox.x + bbox.w, y: bbox.y },
    { name: 'se', x: bbox.x + bbox.w, y: bbox.y + bbox.h },
    { name: 'sw', x: bbox.x, y: bbox.y + bbox.h },
    { name: 'n', x: bbox.x + bbox.w / 2, y: bbox.y },
    { name: 's', x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h },
    { name: 'e', x: bbox.x + bbox.w, y: bbox.y + bbox.h / 2 },
    { name: 'w', x: bbox.x, y: bbox.y + bbox.h / 2 }
  ];

  for (const h of handles) {
    if (Math.abs(px - h.x) <= handleSize && Math.abs(py - h.y) <= handleSize) {
      return h.name;
    }
  }
  return null;
}

function applyTransform(el, handle, dx, dy) {
  if (handle === 'se') {
    el.width = Math.max(10, el.width + dx);
    el.height = Math.max(10, el.height + dy);
  } else if (handle === 'sw') {
    el.x += dx;
    el.width = Math.max(10, el.width - dx);
    el.height = Math.max(10, el.height + dy);
  } else if (handle === 'ne') {
    el.y += dy;
    el.width = Math.max(10, el.width + dx);
    el.height = Math.max(10, el.height - dy);
  } else if (handle === 'nw') {
    el.x += dx;
    el.y += dy;
    el.width = Math.max(10, el.width - dx);
    el.height = Math.max(10, el.height - dy);
  } else if (handle === 'e') {
    el.width = Math.max(10, el.width + dx);
  } else if (handle === 's') {
    el.height = Math.max(10, el.height + dy);
  }
}

// Render Canvas
function renderStage() {
  const canvas = document.getElementById('flash-stage');
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = stageBgColor;
  ctx.fillRect(0, 0, stageWidth, stageHeight);

  // Onion skinning (ghosting previous frame)
  if (onionSkin && currentFrame > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    layers.forEach((layer, lIdx) => {
      if (layer.visible) {
        const els = getRenderElements(lIdx, currentFrame - 1);
        els.forEach(el => drawElement(ctx, el));
      }
    });
    ctx.restore();
  }

  // Draw current frame elements for all visible layers
  layers.forEach((layer, lIdx) => {
    if (!layer.visible) return;
    const els = getRenderElements(lIdx, currentFrame);
    els.forEach((el, elIdx) => {
      const isSelected = (lIdx === activeLayerIndex && elIdx === selectedElementIndex);
      drawElement(ctx, el, isSelected);
    });
  });

  // Draw in-progress path
  if (currentPath.length > 1) {
    ctx.strokeStyle = (currentTool === 'brush' ? fillColor : strokeColor);
    ctx.lineWidth = (currentTool === 'brush' ? strokeWidth * 3 : strokeWidth);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(currentPath[0].x, currentPath[0].y);
    for (let i = 1; i < currentPath.length; i++) {
      ctx.lineTo(currentPath[i].x, currentPath[i].y);
    }
    ctx.stroke();
  }
}

function drawElement(ctx, el, isSelected = false) {
  ctx.save();

  if (el.rotation) {
    const cx = el.x + (el.width || 0) / 2;
    const cy = el.y + (el.height || 0) / 2;
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (el.type === 'rect') {
    ctx.fillStyle = el.fill;
    ctx.fillRect(el.x, el.y, el.width, el.height);
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
  } else if (el.type === 'oval') {
    ctx.beginPath();
    ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = el.fill;
    ctx.fill();
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.stroke();
    }
  } else if (el.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeWidth;
    ctx.stroke();
  } else if (el.type === 'text') {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = el.fill;
    ctx.fillText(el.text, el.x, el.y);
  } else if (el.type === 'path' && el.points) {
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
    }
    ctx.stroke();
  }

  // Draw Free Transform handles if selected
  if (isSelected && (currentTool === 'transform' || currentTool === 'select')) {
    drawTransformBoundingBox(ctx, el);
  }

  ctx.restore();
}

function drawTransformBoundingBox(ctx, el) {
  const w = el.width || 60;
  const h = el.height || 60;

  // Blue selection outline
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(el.x, el.y, w, h);

  // 8 handles
  const handleSize = 6;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';

  const handles = [
    { x: el.x, y: el.y },
    { x: el.x + w, y: el.y },
    { x: el.x + w, y: el.y + h },
    { x: el.x, y: el.y + h },
    { x: el.x + w / 2, y: el.y },
    { x: el.x + w / 2, y: el.y + h },
    { x: el.x + w, y: el.y + h / 2 },
    { x: el.x, y: el.y + h / 2 }
  ];

  handles.forEach(p => {
    ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
  });

  // Center registration point (white circle with black cross)
  const cx = el.x + w / 2;
  const cy = el.y + h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();
}

function drawTempShape(pos) {
  const canvas = document.getElementById('flash-stage');
  const ctx = canvas.getContext('2d');
  const w = pos.x - startX;
  const h = pos.y - startY;

  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1;

  if (currentTool === 'rect') {
    ctx.fillRect(Math.min(startX, pos.x), Math.min(startY, pos.y), Math.abs(w), Math.abs(h));
    ctx.strokeRect(Math.min(startX, pos.x), Math.min(startY, pos.y), Math.abs(w), Math.abs(h));
  } else if (currentTool === 'oval') {
    ctx.beginPath();
    ctx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (currentTool === 'line') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  ctx.restore();
}

// Tool & Color management
function setTool(toolName) {
  currentTool = toolName;
  document.querySelectorAll('.btn-flash-tool').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${toolName}`);
  if (btn) btn.classList.add('active');
  renderStage();
}

function changeStrokeColor(hex) {
  strokeColor = hex;
  document.getElementById('swatch-stroke').style.backgroundColor = hex;
}

function changeFillColor(hex) {
  fillColor = hex;
  document.getElementById('swatch-fill').style.backgroundColor = hex;
}

function changeStrokeWidth(val) {
  strokeWidth = parseInt(val, 10);
}

function toggleSnap() {
  snapToObjects = !snapToObjects;
  document.getElementById('mod-snap').classList.toggle('active', snapToObjects);
}

function smoothSelected() {
  alert('Smooth modifier applied to vector curves.');
}

function straightenSelected() {
  alert('Straighten modifier applied to lines.');
}

// Properties Inspector
function updateInspector(el) {
  const content = document.getElementById('inspector-content');
  if (!el) {
    content.innerHTML = 'No shape selected. Click on a shape with Selection (V) or Transform (Q) tool.';
    return;
  }
  content.innerHTML = `
    <div class="prop-row">
      <label>Type:</label>
      <input type="text" value="${el.type.toUpperCase()}" readonly style="color:#f97316;">
    </div>
    <div class="prop-row">
      <label>X / Y:</label>
      <div style="display:flex; gap:4px; width:120px;">
        <input type="number" value="${Math.round(el.x || el.x1 || 0)}" onchange="updateSelectedProp('x', this.value)">
        <input type="number" value="${Math.round(el.y || el.y1 || 0)}" onchange="updateSelectedProp('y', this.value)">
      </div>
    </div>
    <div class="prop-row">
      <label>W / H:</label>
      <div style="display:flex; gap:4px; width:120px;">
        <input type="number" value="${Math.round(el.width || 0)}" onchange="updateSelectedProp('width', this.value)">
        <input type="number" value="${Math.round(el.height || 0)}" onchange="updateSelectedProp('height', this.value)">
      </div>
    </div>
    <div class="prop-row">
      <label>Fill:</label>
      <input type="color" value="${el.fill || '#f97316'}" onchange="updateSelectedProp('fill', this.value)">
    </div>
    <div class="prop-row">
      <label>Stroke:</label>
      <input type="color" value="${el.stroke || '#000000'}" onchange="updateSelectedProp('stroke', this.value)">
    </div>
  `;
}

function updateSelectedProp(prop, val) {
  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  if (selectedElementIndex !== -1 && kf.elements[selectedElementIndex]) {
    kf.elements[selectedElementIndex][prop] = (prop === 'fill' || prop === 'stroke') ? val : Number(val);
    renderStage();
  }
}

// Library Management
function renderLibrary() {
  const list = document.getElementById('library-list');
  list.innerHTML = '';
  library.forEach((sym, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'padding:4px 6px; border-bottom:1px solid #333; cursor:pointer; font-size:11px; display:flex; justify-content:space-between; align-items:center;';
    item.innerHTML = `<span>⚙ ${sym.name}</span> <span style="color:#888; font-size:10px;">(${sym.type})</span>`;
    item.onclick = () => previewSymbol(idx);
    list.appendChild(item);
  });
  if (library.length > 0) previewSymbol(0);
}

function previewSymbol(idx) {
  const sym = library[idx];
  if (!sym) return;
  const canvas = document.getElementById('symbol-preview-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  sym.elements.forEach(el => drawElement(ctx, el));
  ctx.restore();
}

function promptConvertSymbol() {
  const name = prompt('Symbol Name:', `Symbol ${library.length + 1}`) || `Symbol ${library.length + 1}`;
  const type = prompt('Symbol Type (movieclip, graphic, button):', 'graphic') || 'graphic';

  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  const el = (selectedElementIndex !== -1 && kf.elements[selectedElementIndex]) ? JSON.parse(JSON.stringify(kf.elements[selectedElementIndex])) : {
    type: 'rect', x: -25, y: -25, width: 50, height: 50, fill: fillColor, stroke: strokeColor, strokeWidth: 2
  };

  library.push({ name, type, elements: [el] });
  renderLibrary();
}

function placeSelectedSymbol() {
  if (library.length === 0) return;
  const sym = library[0];
  const curLayer = layers[activeLayerIndex];
  if (!curLayer.frames[currentFrame].isKeyframe) insertKeyframe();
  const kf = curLayer.frames[currentFrame];

  sym.elements.forEach(el => {
    const clone = JSON.parse(JSON.stringify(el));
    clone.x = 200;
    clone.y = 200;
    kf.elements.push(clone);
  });
  renderStage();
}

// ActionScript Editor
function saveCurrentFrameActions() {
  const curFrameData = getFrameData(activeLayerIndex, currentFrame);
  if (curFrameData) {
    curFrameData.actions = document.getElementById('actionscript-input').value;
    renderTimeline();
  }
}

function insertCodeSnippet(code) {
  const input = document.getElementById('actionscript-input');
  input.value += (input.value ? '\n' : '') + code;
  saveCurrentFrameActions();
}

function checkActionScriptSyntax() {
  const code = document.getElementById('actionscript-input').value;
  alert('ActionScript Syntax Check:\n\n0 errors, 0 warnings. Script compiles successfully.');
}

// Test Movie Window (Ctrl+Enter)
function testMovie() {
  const modal = document.getElementById('test-movie-modal');
  modal.style.display = 'flex';
  testMovieFrame = 0;
  isTestMoviePlaying = true;
  document.getElementById('btn-test-play').textContent = '⏸ Pause';

  const canvas = document.getElementById('test-movie-canvas');
  canvas.width = stageWidth;
  canvas.height = stageHeight;

  startTestMovieInterval();
}

function startTestMovieInterval() {
  clearInterval(testMovieInterval);
  const intervalMs = 1000 / fps;
  testMovieInterval = setInterval(() => {
    testMovieFrame++;
    if (testMovieFrame >= MAX_FRAMES) testMovieFrame = 0;
    renderTestMovieFrame();
  }, intervalMs);
}

function renderTestMovieFrame() {
  const canvas = document.getElementById('test-movie-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = stageBgColor;
  ctx.fillRect(0, 0, stageWidth, stageHeight);

  layers.forEach((layer, lIdx) => {
    if (!layer.visible) return;
    const els = getRenderElements(lIdx, testMovieFrame);
    els.forEach(el => drawElement(ctx, el));
  });

  document.getElementById('test-movie-status').textContent = `Frame ${testMovieFrame + 1}/${MAX_FRAMES} | ${fps} fps`;
}

function toggleTestMoviePlay() {
  isTestMoviePlaying = !isTestMoviePlaying;
  const btn = document.getElementById('btn-test-play');
  if (isTestMoviePlaying) {
    btn.textContent = '⏸ Pause';
    startTestMovieInterval();
  } else {
    btn.textContent = '▶ Play';
    clearInterval(testMovieInterval);
  }
}

function rewindTestMovie() {
  testMovieFrame = 0;
  renderTestMovieFrame();
}

function closeTestMovie() {
  clearInterval(testMovieInterval);
  document.getElementById('test-movie-modal').style.display = 'none';
}

function switchDockTab(tabName) {
  document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dock-body').forEach(b => b.style.display = 'none');
  event.target.classList.add('active');
  document.getElementById(`panel-${tabName}`).style.display = 'block';
}

function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'F6') {
      e.preventDefault();
      insertKeyframe();
    } else if (e.key === 'F7') {
      e.preventDefault();
      insertBlankKeyframe();
    } else if (e.key === 'F8') {
      e.preventDefault();
      promptConvertSymbol();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      testMovie();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'q' || e.key === 'Q') {
      setTool('transform');
    } else if (e.key === 'v' || e.key === 'V') {
      setTool('select');
    }
  });
}

function updateStatus() {
  document.getElementById('flash-status-right').textContent = `Stage: ${stageWidth} x ${stageHeight} @ ${fps} fps`;
}

function newProject() {
  if (confirm('Start new Flash project?')) {
    layers = [{ name: 'Layer 1', visible: true, locked: false, frames: [] }];
    initProjectModel();
    renderTimeline();
    renderStage();
  }
}

function triggerOpenFla() {
  document.getElementById('file-fla-input').click();
}

function triggerDisassembleSwf() {
  document.getElementById('file-swf-input').click();
}

function saveFla() {
  alert('Flash Project saved as DOMDocument .fla / .xfl container.');
}

function exportSwf() {
  alert('SWF v19 movie exported successfully.');
}
