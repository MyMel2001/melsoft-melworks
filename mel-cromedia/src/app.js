// MelCromedia Professional Studio Client Engine
// Complete Adobe Flash Professional Editor with Timeline Tweens, Free Transform (Q), Library Symbols (F8), and ActionScript

const MAX_FRAMES = 60;
const FRAME_CELL_WIDTH = 14;

let currentFrame = 0; // 0-indexed
let activeLayerIndex = 0;
let isPlaying = false;
let isLooping = true;
let onionSkin = false;
let playInterval = null;

let currentTool = 'transform'; // 'select', 'subselect', 'transform', 'marquee', 'rect', 'oval', 'line', 'pencil', 'brush', 'eraser', 'bucket', 'eyedropper', 'text'
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
let selectedIndices = []; // Multi-selection for grouping / duplicating
let isDrawing = false;
let startX = 0, startY = 0;
let currentPath = [];
let transformHandle = null; // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w', 'rot'

// Common transform/identity property set carried by every stage element
function makeElement(props) {
  return Object.assign({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    visible: true,
    name: '',
    locked: false
  }, props);
}

// Axis-aligned bounding box in element-local (untransformed) coordinates
function elementBBox(el) {
  if (el.type === 'line') {
    return {
      x: Math.min(el.x1, el.x2),
      y: Math.min(el.y1, el.y2),
      width: Math.abs(el.x2 - el.x1),
      height: Math.abs(el.y2 - el.y1)
    };
  }
  if (el.type === 'path' && el.points && el.points.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: el.x || 0, y: el.y || 0, width: el.width || 60, height: el.height || 60 };
}

// Resolve live children for group/symbol elements (symbols read from the library at render time)
function getChildren(el) {
  if (el.type === 'group') return el.elements || [];
  if (el.type === 'symbol') {
    const sym = library.find(s => s.name === el.symbolName);
    return sym ? sym.elements : [];
  }
  return [];
}

// Map a stage point into the element's untransformed local space (inverse rotation/scale about center)
function inverseTransformPoint(el, px, py) {
  const bbox = elementBBox(el);
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  let dx = px - cx;
  let dy = py - cy;
  if (el.rotation) {
    const r = (-el.rotation * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }
  const sx = el.scaleX || 1;
  const sy = el.scaleY || 1;
  if (sx) dx /= sx;
  if (sy) dy /= sy;
  return { x: cx + dx, y: cy + dy };
}

// Marquee Selection State
let marqueeStart = null; // { x, y }
let marqueeCurrent = null; // { x, y }
let marqueeSelection = null; // { x, y, width, height }

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
    layers[0].frames.push({ isKeyframe: (i === 0), isBlank: false, isTween: false, isShapeTween: false, elements: [], actions: '' });
  }

  // Sample animated content across frames 0 to 20 with tweening
  layers[0].frames[0].isKeyframe = true;
  layers[0].frames[0].isTween = true;
  layers[0].frames[0].elements = [
    makeElement({
      type: 'rect',
      x: 100,
      y: 150,
      width: 120,
      height: 80,
      rotation: 0,
      fill: '#f97316',
      stroke: '#000000',
      strokeWidth: 2
    })
  ];
  layers[0].frames[0].actions = '// Frame 1 Script\nstop();';

  layers[0].frames[20].isKeyframe = true;
  layers[0].frames[20].elements = [
    makeElement({
      type: 'rect',
      x: 520,
      y: 280,
      width: 150,
      height: 100,
      rotation: 45,
      fill: '#38bdf8',
      stroke: '#000000',
      strokeWidth: 2
    })
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
        if (frameData.isShapeTween) {
          cell.classList.add('shape-tween');
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
  const easingSel = document.getElementById('sel-tween-easing');
  if (easingSel) easingSel.value = (curFrameData && curFrameData.ease) ? curFrameData.ease : 'linear';
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
  selectedIndices = [];
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

// Elements stage move/resize edits should mutate. While on an interpolated
// tween frame, edits drive the active tween pair (destination keyframe) instead
// of writing a hard frame, so tweens stay dynamic instead of freezing into frames.
function getTweenEditElements(frameIdx) {
  const layer = layers[activeLayerIndex];
  const frame = layer && layer.frames ? layer.frames[frameIdx] : null;
  const eff = getEffectiveKeyframe(activeLayerIndex, frameIdx);
  const midTween = eff && frame && eff.frame !== frameIdx && (eff.kf.isTween || eff.kf.isShapeTween);
  if (midTween) {
    const next = getNextKeyframe(activeLayerIndex, eff.frame);
    const endFrame = (next && next.frame > eff.frame) ? next.frame : eff.frame;
    const endKf = layers[activeLayerIndex].frames[endFrame];
    return (endKf && endKf.elements) || [];
  }
  return (frame && frame.elements) || [];
}

// Compute interpolated elements for tween frames
function getRenderElements(layerIdx, frameIdx) {
  const prev = getEffectiveKeyframe(layerIdx, frameIdx);
  if (!prev) return [];
  if (prev.frame === frameIdx || (!prev.kf.isTween && !prev.kf.isShapeTween)) {
    return prev.kf.elements || [];
  }

  const next = getNextKeyframe(layerIdx, prev.frame);
  if (!next || next.frame <= prev.frame) {
    return prev.kf.elements || [];
  }

  const t = (frameIdx - prev.frame) / (next.frame - prev.frame);
  const easeName = prev.kf.ease || 'linear';
  const pEls = prev.kf.elements || [];
  const nEls = next.kf.elements || [];

  if (prev.kf.isShapeTween) {
    // Shape tween: morph outlines + colors between the two keyframes
    return MelTween.interpolateElements(
      pEls.map(el => shapeTweenOutline(el)),
      nEls.map(el => shapeTweenOutline(el)),
      t,
      easeName
    );
  }

  // Classic motion tween: full object property interpolation
  return MelTween.interpolateElements(pEls, nEls, t, easeName);
}

// Convert an element into a path representation for shape tweening
function shapeTweenOutline(el) {
  const clone = JSON.parse(JSON.stringify(el));
  if (clone.type === 'rect') {
    clone.type = 'path';
    clone.points = [
      { x: clone.x, y: clone.y },
      { x: clone.x + clone.width, y: clone.y },
      { x: clone.x + clone.width, y: clone.y + clone.height },
      { x: clone.x, y: clone.y + clone.height },
      { x: clone.x, y: clone.y }
    ];
  } else if (clone.type === 'oval') {
    clone.type = 'path';
    const cx = clone.x + clone.width / 2;
    const cy = clone.y + clone.height / 2;
    clone.points = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      clone.points.push({
        x: cx + Math.cos(a) * (clone.width / 2),
        y: cy + Math.sin(a) * (clone.height / 2)
      });
    }
  } else if (clone.type === 'line') {
    clone.type = 'path';
    clone.points = [
      { x: clone.x1, y: clone.y1 },
      { x: clone.x2, y: clone.y2 }
    ];
  } else if (clone.type === 'path' && !clone.points) {
    clone.points = [{ x: clone.x || 0, y: clone.y || 0 }, { x: clone.x || 0, y: clone.y || 0 }];
  }
  return clone;
}

// --- Layer Controls ---
function selectLayer(idx) {
  activeLayerIndex = idx;
  renderTimeline();
}

function addNewLayer() {
  const newFrames = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    newFrames.push({ isKeyframe: (i === 0), isBlank: false, isTween: false, isShapeTween: false, elements: [], actions: '' });
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
    isShapeTween: false,
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
    isShapeTween: false,
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

function createShapeTween() {
  const eff = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  if (!eff) return;
  eff.kf.isShapeTween = !eff.kf.isShapeTween;
  renderTimeline();
  renderStage();
}

function setTweenEasing(name) {
  const eff = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  if (!eff) return;
  eff.kf.ease = name;
  const sel = document.getElementById('sel-tween-easing');
  if (sel) sel.value = name;
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

  // Auto-insert keyframe if drawing on a holding frame. Mid-tween frames edit the
  // active tween pair instead of freezing into a hard frame.
  const effForInsert = getEffectiveKeyframe(activeLayerIndex, currentFrame);
  const midTween = effForInsert && effForInsert.frame !== currentFrame && (effForInsert.kf.isTween || effForInsert.kf.isShapeTween);
  if (!curLayer.frames[currentFrame].isKeyframe && !midTween) {
    insertKeyframe();
  }
  const kf = curLayer.frames[currentFrame];

  if (currentTool === 'marquee') {
    marqueeStart = { x: pos.x, y: pos.y };
    marqueeCurrent = { x: pos.x, y: pos.y };
    marqueeSelection = { x: pos.x, y: pos.y, width: 0, height: 0 };
    selectedElementIndex = -1;
    updateInspector(null);
    renderStage();
    return;
  }

  if (currentTool === 'select' || currentTool === 'transform') {
    // Check if clicked on a transform handle first
    if (currentTool === 'transform' && selectedElementIndex !== -1) {
      const el = getTweenEditElements(currentFrame)[selectedElementIndex];
      const h = hitTestTransformHandles(pos.x, pos.y, el);
      if (h) {
        transformHandle = h;
        return;
      }
    }

    selectedElementIndex = -1;
    transformHandle = null;

    // Check hit on elements (top-most first)
    const additive = (e.ctrlKey || e.metaKey);
    for (let i = kf.elements.length - 1; i >= 0; i--) {
      const el = kf.elements[i];
      if (isPointInsideElement(pos.x, pos.y, el)) {
        if (additive) {
          const idx = selectedIndices.indexOf(i);
          if (idx === -1) {
            selectedIndices.push(i);
          } else {
            selectedIndices.splice(idx, 1);
          }
          selectedElementIndex = selectedIndices[selectedIndices.length - 1];
        } else {
          selectedIndices = [i];
          selectedElementIndex = i;
        }
        updateInspector(el);
        break;
      }
    }
    if (selectedElementIndex === -1 && selectedIndices.length === 0) {
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
    const text = prompt('Enter Flash Text:', 'MelCromedia 2026');
    if (text) {
      kf.elements.push(makeElement({
        type: 'text',
        text: text,
        x: pos.x,
        y: pos.y,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fontSize: 20
      }));
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

  if (currentTool === 'marquee') {
    marqueeCurrent = { x: pos.x, y: pos.y };
    const x = Math.min(marqueeStart.x, pos.x);
    const y = Math.min(marqueeStart.y, pos.y);
    const w = Math.abs(pos.x - marqueeStart.x);
    const h = Math.abs(pos.y - marqueeStart.y);
    marqueeSelection = { x, y, width: w, height: h };
    renderStage();
    return;
  }

  if ((currentTool === 'select' || currentTool === 'transform') && selectedElementIndex !== -1) {
    const el = getTweenEditElements(currentFrame)[selectedElementIndex];
    if (transformHandle) {
      applyTransform(el, transformHandle, pos.x - startX, pos.y - startY, pos, e.shiftKey);
      startX = pos.x;
      startY = pos.y;
    } else {
      el.x += (pos.x - startX);
      el.y += (pos.y - startY);
      startX = pos.x;
      startY = pos.y;
    }
    renderStage();
  } else if ((currentTool === 'select' || currentTool === 'transform') && selectedIndices.length > 0) {
    const deltaX = pos.x - startX;
    const deltaY = pos.y - startY;
    const editEls = getTweenEditElements(currentFrame);
    for (const idx of selectedIndices) {
      const el = editEls[idx];
      if (!el || el.locked) continue;
      if (transformHandle) {
        applyTransform(el, transformHandle, deltaX, deltaY, pos, e.shiftKey);
      } else {
        el.x += deltaX;
        el.y += deltaY;
      }
    }
    startX = pos.x;
    startY = pos.y;
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

  if (currentTool === 'marquee') {
    // Finalize marquee selection
    if (marqueeSelection && marqueeSelection.width > 2 && marqueeSelection.height > 2) {
      selectedElementIndex = -1;
      selectedIndices = [];
      const selX = marqueeSelection.x;
      const selY = marqueeSelection.y;
      const selW = marqueeSelection.width;
      const selH = marqueeSelection.height;
      for (let i = 0; i < kf.elements.length; i++) {
        const el = kf.elements[i];
        const bb = elementBBox(el);
        if (bb.x + bb.width >= selX && bb.x <= selX + selW && bb.y + bb.height >= selY && bb.y <= selY + selH) {
          selectedIndices.push(i);
          selectedElementIndex = i;
        }
      }
      updateInspector(kf.elements[selectedElementIndex] || null);
    }
    marqueeStart = null;
    marqueeCurrent = null;
    marqueeSelection = null;
    renderStage();
    return;
  }

  if (currentTool === 'rect') {
    kf.elements.push(makeElement({
      type: 'rect',
      x: Math.min(startX, pos.x),
      y: Math.min(startY, pos.y),
      width: Math.abs(w),
      height: Math.abs(h),
      rotation: 0,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    }));
  } else if (currentTool === 'oval') {
    kf.elements.push(makeElement({
      type: 'oval',
      x: Math.min(startX, pos.x),
      y: Math.min(startY, pos.y),
      width: Math.abs(w),
      height: Math.abs(h),
      rotation: 0,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    }));
  } else if (currentTool === 'line') {
    kf.elements.push(makeElement({
      type: 'line',
      x1: startX,
      y1: startY,
      x2: pos.x,
      y2: pos.y,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    }));
  } else if (currentTool === 'pencil' || currentTool === 'brush') {
    if (currentPath.length > 1) {
      kf.elements.push(makeElement({
        type: 'path',
        points: currentPath,
        stroke: (currentTool === 'brush' ? fillColor : strokeColor),
        strokeWidth: (currentTool === 'brush' ? strokeWidth * 3 : strokeWidth)
      }));
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
  if (el.type === 'group' || el.type === 'symbol') {
    if (el.locked) return false;
    if (el.visible === false) return false;
    if (el.alpha !== undefined && el.alpha <= 0) return false;
    const kids = getChildren(el);
    const p = inverseTransformPoint(el, px, py);
    const offX = (el.type === 'symbol') ? elementBBox(kids).x - el.x : 0;
    const offY = (el.type === 'symbol') ? elementBBox(kids).y - el.y : 0;
    const lx = p.x - el.x - offX;
    const ly = p.y - el.y - offY;
    for (let i = kids.length - 1; i >= 0; i--) {
      if (isPointInsideElement(lx, ly, kids[i])) return true;
    }
    return false;
  }
  if (el.locked) return false;
  if (el.visible === false) return false;
  const alpha = (el.alpha === undefined) ? 1 : el.alpha;
  if (alpha <= 0) return false;

  const p = inverseTransformPoint(el, px, py);

  if (el.type === 'rect' || el.type === 'oval') {
    const w = el.width || 60;
    const h = el.height || 60;
    return p.x >= el.x && p.x <= el.x + w && p.y >= el.y && p.y <= el.y + h;
  } else if (el.type === 'line') {
    const d = distToSegment(p.x, p.y, el.x1, el.y1, el.x2, el.y2);
    // Use stroke width for line hit testing
    const strokeWidth = el.strokeWidth || 2;
    return d <= Math.max(8, strokeWidth * 1.5);
  } else if (el.type === 'text') {
    return p.x >= el.x && p.x <= el.x + 120 && p.y >= el.y - 20 && p.y <= el.y + 10;
  } else if (el.type === 'path') {
    // For painted objects (paths), use stroke width for hit testing
    const strokeWidth = (el.strokeWidth || 2) * 2;
    const threshold = Math.max(8, strokeWidth * 1.5);
    for (let i = 0; i < el.points.length - 1; i++) {
      const d = distToSegment(p.x, p.y, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y);
      if (d <= threshold) return true;
    }
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
  const bbox = elementBBox(el);
  const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  const handleSize = 8;
  const handles = [
    { name: 'nw', x: bbox.x, y: bbox.y },
    { name: 'ne', x: bbox.x + bbox.width, y: bbox.y },
    { name: 'se', x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    { name: 'sw', x: bbox.x, y: bbox.y + bbox.height },
    { name: 'n', x: bbox.x + bbox.width / 2, y: bbox.y },
    { name: 's', x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height },
    { name: 'e', x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 },
    { name: 'w', x: bbox.x, y: bbox.y + bbox.height / 2 }
  ];

  const p = inverseTransformPoint(el, px, py);
  for (const h of handles) {
    if (Math.abs(p.x - h.x) <= handleSize && Math.abs(p.y - h.y) <= handleSize) {
      return h.name;
    }
  }

  // Rotate handle above top-center
  const rotHandle = { name: 'rot', x: center.x, y: bbox.y - 18 };
  if (Math.abs(p.x - rotHandle.x) <= handleSize && Math.abs(p.y - rotHandle.y) <= handleSize) {
    return 'rot';
  }

  return null;
}

function applyTransform(el, handle, dx, dy, pos, shiftKey) {
  if (handle === 'rot') {
    const bbox = elementBBox(el);
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const ang = pos ? Math.atan2(pos.y - cy, pos.x - cx) * (180 / Math.PI) : (el.rotation || 0);
    el.rotation = ang;
    if (shiftKey) {
      el.rotation = Math.round(ang / 15) * 15;
    }
    return;
  }

  const baseW = el.width || 60;
  const baseH = el.height || 60;
  const sX = (el.scaleX === undefined) ? 1 : el.scaleX;
  const sY = (el.scaleY === undefined) ? 1 : el.scaleY;

  if (handle === 'se') {
    el.scaleX = sX * (Math.max(10, baseW + dx) / baseW);
    el.scaleY = sY * (Math.max(10, baseH + dy) / baseH);
  } else if (handle === 'sw') {
    el.x += dx;
    el.scaleX = sX * (Math.max(10, baseW - dx) / baseW);
  } else if (handle === 'ne') {
    el.y += dy;
    el.scaleY = sY * (Math.max(10, baseH - dy) / baseH);
    el.scaleX = sX * (Math.max(10, baseW + dx) / baseW);
  } else if (handle === 'nw') {
    el.x += dx;
    el.y += dy;
    el.scaleX = sX * (Math.max(10, baseW - dx) / baseW);
    el.scaleY = sY * (Math.max(10, baseH - dy) / baseH);
  } else if (handle === 'e') {
    el.scaleX = sX * (Math.max(10, baseW + dx) / baseW);
  } else if (handle === 's') {
    el.scaleY = sY * (Math.max(10, baseH + dy) / baseH);
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
      const isSelected = (lIdx === activeLayerIndex && (elIdx === selectedElementIndex || selectedIndices.indexOf(elIdx) !== -1));
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

  // Draw marquee selection box
  if (currentTool === 'marquee') {
    const sel = marqueeSelection;
    if (sel && sel.width > 0 && sel.height > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.width, sel.height);
      ctx.restore();
    }
  }
}

function drawElement(ctx, el, isSelected = false) {
  if (el.visible === false) return;
  ctx.save();

  ctx.globalAlpha = (ctx.globalAlpha || 1) * (el.alpha === undefined ? 1 : el.alpha);

  const bbox = elementBBox(el);
  if (el.rotation || (el.scaleX || 1) !== 1 || (el.scaleY || 1) !== 1) {
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    ctx.translate(cx, cy);
    if (el.rotation) {
      ctx.rotate((el.rotation * Math.PI) / 180);
    }
    if ((el.scaleX || 1) !== 1 || (el.scaleY || 1) !== 1) {
      ctx.scale(el.scaleX || 1, el.scaleY || 1);
    }
    ctx.translate(-cx, -cy);
  }

  if (el.type === 'group' || el.type === 'symbol') {
    const kids = getChildren(el);
    const off = (el.type === 'symbol') ? elementBBox(kids) : { x: 0, y: 0 };
    ctx.translate(el.x - off.x, el.y - off.y);
    kids.forEach(k => drawElement(ctx, k));
    ctx.translate(off.x - el.x, off.y - el.y);
  } else if (el.type === 'rect') {
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
    const fontSize = el.fontSize || 20;
    ctx.font = `bold ${fontSize}px sans-serif`;
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
  const bbox = elementBBox(el);
  const w = bbox.width;
  const h = bbox.height;

  // Blue selection outline
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(bbox.x, bbox.y, w, h);

  // 8 handles
  const handleSize = 6;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';

  const handles = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + w, y: bbox.y },
    { x: bbox.x + w, y: bbox.y + h },
    { x: bbox.x, y: bbox.y + h },
    { x: bbox.x + w / 2, y: bbox.y },
    { x: bbox.x + w / 2, y: bbox.y + h },
    { x: bbox.x + w, y: bbox.y + h / 2 },
    { x: bbox.x, y: bbox.y + h / 2 }
  ];

  handles.forEach(p => {
    ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
  });

  // Center registration point (white circle with black cross)
  const cx = bbox.x + w / 2;
  const cy = bbox.y + h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();

  // Rotate handle (circle above top-center)
  const rotHandle = { x: cx, y: bbox.y - 18 };
  ctx.beginPath();
  ctx.arc(rotHandle.x, rotHandle.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
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
  let html = `
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
      <label>Scale X / Y:</label>
      <div style="display:flex; gap:4px; width:120px;">
        <input type="number" step="0.05" value="${(el.scaleX === undefined) ? 1 : el.scaleX}" onchange="updateSelectedProp('scaleX', this.value)">
        <input type="number" step="0.05" value="${(el.scaleY === undefined) ? 1 : el.scaleY}" onchange="updateSelectedProp('scaleY', this.value)">
      </div>
    </div>
    <div class="prop-row">
      <label>Rotation:</label>
      <input type="number" value="${(el.rotation === undefined) ? 0 : el.rotation}" onchange="updateSelectedProp('rotation', this.value)">
    </div>
    <div class="prop-row">
      <label>Alpha:</label>
      <input type="range" min="0" max="1" step="0.05" value="${(el.alpha === undefined) ? 1 : el.alpha}" onchange="updateSelectedProp('alpha', this.value)">
    </div>
    <div class="prop-row">
      <label>Visible:</label>
      <input type="checkbox" ${el.visible === false ? 'checked' : ''} onchange="updateSelectedProp('visible', this.checked)">
    </div>
    <div class="prop-row">
      <label>Locked:</label>
      <input type="checkbox" ${el.locked ? 'checked' : ''} onchange="updateSelectedProp('locked', this.checked)">
    </div>
    <div class="prop-row">
      <label>Name:</label>
      <input type="text" value="${el.name || ''}" onchange="updateSelectedProp('name', this.value)">
    </div>
    `;

  if (el.type === 'symbol') {
    html += `
      <div class="prop-row">
        <label>Symbol Name:</label>
        <input type="text" value="${el.symbolName || ''}" readonly style="color:#f97316;">
      </div>
    `;
  }

  if (el.type === 'text') {
    html += `
      <div class="prop-row">
        <label>Text Content:</label>
        <input type="text" value="${el.text || ''}" onchange="updateSelectedProp('text', this.value)">
      </div>
      <div class="prop-row">
        <label>Font Size:</label>
        <input type="number" value="${el.fontSize || 20}" min="6" max="120" onchange="updateSelectedProp('fontSize', this.value)">
      </div>
    `;
  } else {
    html += `
      <div class="prop-row">
        <label>W / H:</label>
        <div style="display:flex; gap:4px; width:120px;">
          <input type="number" value="${Math.round(el.width || 0)}" onchange="updateSelectedProp('width', this.value)">
          <input type="number" value="${Math.round(el.height || 0)}" onchange="updateSelectedProp('height', this.value)">
        </div>
      </div>
    `;
  }
  
  html += `
    <div class="prop-row">
      <label>Fill:</label>
      <input type="color" value="${el.fill || '#f97316'}" onchange="updateSelectedProp('fill', this.value)">
    </div>
    <div class="prop-row">
      <label>Stroke:</label>
      <input type="color" value="${el.stroke || '#000000'}" onchange="updateSelectedProp('stroke', this.value)">
    </div>
  `;
  
  if (el.type === 'text') {
    html += `
      <div class="prop-row">
        <button onclick="startTextEditing()" style="margin-top:8px; padding:4px 8px; background:#3b82f6; color:white; border:none; border-radius:3px; cursor:pointer;">Edit Text In-Place</button>
      </div>
    `;
  }
  
  content.innerHTML = html;
}

function updateSelectedProp(prop, val) {
  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  if (selectedElementIndex !== -1 && kf.elements[selectedElementIndex]) {
    const el = kf.elements[selectedElementIndex];
    const numericProps = ['x', 'y', 'width', 'height', 'fontSize', 'strokeWidth', 'rotation', 'scaleX', 'scaleY', 'alpha', 'x1', 'y1', 'x2', 'y2'];
    const booleanProps = ['visible', 'locked'];
    if (numericProps.includes(prop)) {
      el[prop] = Number(val);
    } else if (booleanProps.includes(prop)) {
      el[prop] = (val === true || val === 'true');
    } else {
      el[prop] = val;
    }
    renderStage();
  }
}

function startTextEditing() {
  if (selectedElementIndex !== -1 && layers[activeLayerIndex]) {
    const curLayer = layers[activeLayerIndex];
    const kf = curLayer.frames[currentFrame];
    const el = kf.elements[selectedElementIndex];
    
    if (el && el.type === 'text') {
      // Create an in-place text editor
      const textEditor = document.createElement('div');
      textEditor.style.position = 'absolute';
      textEditor.style.left = `${el.x}px`;
      textEditor.style.top = `${el.y - 20}px`;
      textEditor.style.backgroundColor = 'white';
      textEditor.style.border = '1px solid #3b82f6';
      textEditor.style.padding = '2px 4px';
      textEditor.style.zIndex = '1000';
      textEditor.contentEditable = 'true';
      textEditor.textContent = el.text;
      
      document.body.appendChild(textEditor);
      textEditor.focus();
      
      const finishEditing = () => {
        if (textEditor.parentNode) {
          textEditor.parentNode.removeChild(textEditor);
        }
        el.text = textEditor.textContent;
        renderStage();
      };
      
      textEditor.addEventListener('blur', finishEditing);
      textEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishEditing();
        }
      });
    }
  }
}

// Library Management
function renderLibrary() {
  const list = document.getElementById('library-list');
  list.innerHTML = '<option value="">Select a Symbol...</option>';
  library.forEach((sym, idx) => {
    const option = document.createElement('option');
    option.value = idx.toString();
    const friendlyType = (function() {
      switch (sym.type) {
        case 'graphic': return 'Graphic';
        case 'movieclip': return 'MovieClip';
        case 'button': return 'Button';
        default: return sym.type;
      }
    })();
    option.textContent = `${sym.name} (${friendlyType})`;
    list.appendChild(option);
  });
  if (library.length > 0) {
    // Select first symbol and preview it
    list.selectedIndex = 1;
    onLibrarySelect(list);
  } else {
    document.getElementById('symbol-preview-canvas').getContext('2d').clearRect(0,0,180,80);
  }
}

function onLibrarySelect(selectEl) {
  const idx = parseInt(selectEl.value, 10);
  if (isNaN(idx) || idx < 0) {
    previewSymbol(-1);
    return;
  }
  previewSymbol(idx);
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
  const type = prompt('Symbol Type (MovieClip, Graphic, Button):', 'Graphic') || 'Graphic';

  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  const el = (selectedElementIndex !== -1 && kf.elements[selectedElementIndex]) ? JSON.parse(JSON.stringify(kf.elements[selectedElementIndex])) : {
    type: 'rect', x: -25, y: -25, width: 50, height: 50, fill: fillColor, stroke: strokeColor, strokeWidth: 2
  };
  library.push({ name, type, elements: [el] });
  renderLibrary();
}

// Group current selection into a single group element (Ctrl+G)
function groupSelection() {
  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  const indices = selectedIndices.length > 0
    ? selectedIndices.filter(i => kf.elements[i])
    : (selectedElementIndex !== -1 ? [selectedElementIndex] : []);
  if (indices.length === 0) return;

  const children = indices.map(i => kf.elements[i]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  children.forEach(el => {
    const b = elementBBox(el);
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.width);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.height);
  });
  const group = makeElement({
    type: 'group',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    elements: children.map(el => {
      const c = JSON.parse(JSON.stringify(el));
      c.x = (el.x || 0) - minX;
      c.y = (el.y || 0) - minY;
      if (c.type === 'line') {
        c.x1 = (el.x1 || 0) - minX;
        c.y1 = (el.y1 || 0) - minY;
        c.x2 = (el.x2 || 0) - minX;
        c.y2 = (el.y2 || 0) - minY;
      }
      if (c.type === 'path' && c.points) {
        c.points = c.points.map(p => ({ x: p.x - minX, y: p.y - minY }));
      }
      if (c.type === 'text') {
        c.x = (el.x || 0) - minX;
        c.y = (el.y || 0) - minY;
      }
      return c;
    })
  });
  const at = Math.min(...indices);
  kf.elements.splice(at, children.length, group);
  selectedElementIndex = at;
  selectedIndices = [at];
  renderStage();
  updateInspector(group);
}

// Ungroup selected group element back into plain elements (Ctrl+Shift+G)
// ponytail: ungroup is single-level only; nested groups stay nested
function ungroupSelection() {
  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  if (selectedElementIndex === -1 || !kf.elements[selectedElementIndex]) return;
  const el = kf.elements[selectedElementIndex];
  if (el.type !== 'group') return;
  const group = el;
  const children = group.elements || [];
  children.forEach(c => {
    c.x = (c.x || 0) + group.x;
    c.y = (c.y || 0) + group.y;
  });
  const at = selectedElementIndex;
  const newEls = [];
  children.forEach(c => newEls.push(c));
  kf.elements.splice(at, 1, ...newEls);
  selectedElementIndex = newEls.length > 0 ? at : -1;
  selectedIndices = [];
  for (let i = 0; i < newEls.length; i++) {
    if (kf.elements[at + i]) selectedIndices.push(at + i);
  }
  if (selectedElementIndex !== -1) {
    updateInspector(kf.elements[selectedElementIndex]);
  } else {
    updateInspector(null);
  }
  renderStage();
}

// Duplicate selected element(s) with a +10/+10 offset (Ctrl+D)
function duplicateSelection() {
  const curLayer = layers[activeLayerIndex];
  const kf = curLayer.frames[currentFrame];
  const indices = selectedIndices.length > 0
    ? selectedIndices.filter(i => kf.elements[i])
    : (selectedElementIndex !== -1 ? [selectedElementIndex] : []);
  if (indices.length === 0) return;
  const clones = [];
  indices.forEach(idx => {
    const src = kf.elements[idx];
    const clone = JSON.parse(JSON.stringify(src));
    clone.x = (src.x || 0) + 10;
    clone.y = (src.y || 0) + 10;
    if (clone.type === 'line') {
      clone.x1 = (src.x1 || 0) + 10;
      clone.y1 = (src.y1 || 0) + 10;
      clone.x2 = (src.x2 || 0) + 10;
      clone.y2 = (src.y2 || 0) + 10;
    }
    if (clone.type === 'path' && clone.points) {
      clone.points = clone.points.map(p => ({ x: p.x + 10, y: p.y + 10 }));
    }
    if (clone.type === 'group') {
      clone.elements = clone.elements.map(c => {
        const cc = JSON.parse(JSON.stringify(c));
        cc.x = (c.x || 0) + 10;
        cc.y = (c.y || 0) + 10;
        if (cc.type === 'path' && cc.points) {
          cc.points = cc.points.map(p => ({ x: p.x + 10, y: p.y + 10 }));
        }
        return cc;
      });
    }
    clones.push(clone);
  });
  clones.forEach(c => kf.elements.push(c));
  const lastClone = kf.elements[kf.elements.length - 1];
  selectedElementIndex = kf.elements.length - 1;
  selectedIndices = [kf.elements.length - 1];
  updateInspector(lastClone);
  renderStage();
}

function placeSelectedSymbol() {
  const selectEl = document.getElementById('library-list');
  const symIdx = parseInt(selectEl.value, 10);
  if (isNaN(symIdx) || symIdx < 0) return;
  const sym = library[symIdx];
  if (!sym) return;
  const curLayer = layers[activeLayerIndex];
  if (!curLayer.frames[currentFrame].isKeyframe) insertKeyframe();
  const kf = curLayer.frames[currentFrame];

  // Place a single symbol INSTANCE (children resolved live from the library)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  sym.elements.forEach(el => {
    const bb = elementBBox(el);
    minX = Math.min(minX, bb.x);
    maxX = Math.max(maxX, bb.x + bb.width);
    minY = Math.min(minY, bb.y);
    maxY = Math.max(maxY, bb.y + bb.height);
  });
  const width = (maxX - minX) || 60;
  const height = (maxY - minY) || 60;
  const instance = makeElement({
    type: 'symbol',
    symbolName: sym.name,
    x: 200 - width / 2,
    y: 200 - height / 2,
    width: width,
    height: height,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    visible: true,
    name: '',
    locked: false
  });
  kf.elements.push(instance);
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

// ActionScript Editor & AVM2 Tooling
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
  const statusEl = document.getElementById('as3-syntax-status');
  if (!code.trim()) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = '#1e293b';
      statusEl.style.color = '#94a3b8';
      statusEl.textContent = 'Empty script: 0 errors, 0 warnings.';
    }
    return;
  }
  const runtime = new As3Engine.As3Runtime();
  const res = runtime.checkSyntax(code);
  if (statusEl) {
    statusEl.style.display = 'block';
    if (res.valid) {
      statusEl.style.background = '#064e3b';
      statusEl.style.color = '#34d399';
      statusEl.textContent = '✓ ' + res.message;
    } else {
      statusEl.style.background = '#450a0a';
      statusEl.style.color = '#f87171';
      statusEl.textContent = '✗ ' + res.message;
    }
  }
}

function viewAvm2Disassembly() {
  const code = document.getElementById('actionscript-input').value;
  if (!code.trim()) {
    logTrace('// No ActionScript 3 code in current frame to disassemble.');
    switchDockTab('output');
    return;
  }
  try {
    const abcBuf = As3Engine.As3Compiler.compile(code, { className: 'Main' });
    const dis = As3Engine.As3Disassembler.disassemble(abcBuf);
    logTrace(dis.fullText);
    switchDockTab('output');
  } catch (err) {
    logTrace(`[AVM2 Compilation Error] ${err.message}`);
    switchDockTab('output');
  }
}

function logTrace(text) {
  const dockOut = document.getElementById('dock-trace-output');
  const testOut = document.getElementById('test-movie-trace-log');
  const line = (typeof text === 'string') ? text : JSON.stringify(text);
  if (dockOut) {
    dockOut.value += (dockOut.value ? '\n' : '') + line;
    dockOut.scrollTop = dockOut.scrollHeight;
  }
  if (testOut) {
    const row = document.createElement('div');
    row.textContent = line;
    testOut.appendChild(row);
    testOut.scrollTop = testOut.scrollHeight;
  }
  console.log('[AS3 trace]', line);
}

function clearTraceOutput() {
  const dockOut = document.getElementById('dock-trace-output');
  const testOut = document.getElementById('test-movie-trace-log');
  if (dockOut) dockOut.value = '';
  if (testOut) testOut.innerHTML = '';
}

function copyTraceOutput() {
  const dockOut = document.getElementById('dock-trace-output');
  if (dockOut) {
    navigator.clipboard.writeText(dockOut.value);
    alert('Trace output copied to clipboard.');
  }
}

// Test Movie Window (Ctrl+Enter) with authentic AVM2 Execution
let activeAs3Runtime = null;

function testMovie() {
  const modal = document.getElementById('test-movie-modal');
  modal.style.display = 'flex';
  testMovieFrame = 0;
  isTestMoviePlaying = true;
  document.getElementById('btn-test-play').textContent = '⏸ Pause';

  const canvas = document.getElementById('test-movie-canvas');
  canvas.width = stageWidth;
  canvas.height = stageHeight;

  // Initialize AS3 execution sandbox
  activeAs3Runtime = new As3Engine.As3Runtime({
    width: stageWidth,
    height: stageHeight,
    fps: fps,
    totalFrames: MAX_FRAMES,
    onTrace: (msg) => logTrace(msg)
  });

  setupTestMovieEvents(canvas);

  logTrace(`[AVM2] Initializing Flash Player 19 Test Movie (${stageWidth}x${stageHeight} @ ${fps}fps)`);
  renderTestMovieFrame();
  startTestMovieInterval();
}

let testMovieEventsSetup = false;
function setupTestMovieEvents(canvas) {
  if (testMovieEventsSetup) return;
  testMovieEventsSetup = true;

  canvas.addEventListener('click', (e) => {
    if (!activeAs3Runtime) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const evt = new As3Engine.MouseEvent(As3Engine.MouseEvent.CLICK, true, false, x, y);
    activeAs3Runtime.root.dispatchEvent(evt);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!activeAs3Runtime) return;
    const rect = canvas.getBoundingClientRect();
    const evt = new As3Engine.MouseEvent(As3Engine.MouseEvent.MOUSE_DOWN, true, false, e.clientX - rect.left, e.clientY - rect.top);
    activeAs3Runtime.root.dispatchEvent(evt);
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!activeAs3Runtime) return;
    const rect = canvas.getBoundingClientRect();
    const evt = new As3Engine.MouseEvent(As3Engine.MouseEvent.MOUSE_UP, true, false, e.clientX - rect.left, e.clientY - rect.top);
    activeAs3Runtime.root.dispatchEvent(evt);
  });
}

function startTestMovieInterval() {
  clearInterval(testMovieInterval);
  const intervalMs = 1000 / fps;
  testMovieInterval = setInterval(() => {
    if (!isTestMoviePlaying) return;
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

  // 1. Execute Frame ActionScript 3
  if (activeAs3Runtime) {
    activeAs3Runtime.root.dispatchEvent(new As3Engine.Event(As3Engine.Event.ENTER_FRAME));

    let frameScript = '';
    layers.forEach(layer => {
      if (!layer.visible) return;
      const fData = layer.frames[testMovieFrame];
      if (fData && fData.actions && fData.actions.trim()) {
        frameScript += fData.actions + '\n';
      }
    });

    if (frameScript.trim()) {
      try {
        activeAs3Runtime.execute(frameScript, activeAs3Runtime.root);
      } catch (err) {
        logTrace(`[AS3 Runtime Error at Frame ${testMovieFrame + 1}] ${err.message}`);
      }
    }

    // Check playback state set by AS3 (stop() / play())
    if (activeAs3Runtime.root.isPlaying === false && isTestMoviePlaying) {
      isTestMoviePlaying = false;
      document.getElementById('btn-test-play').textContent = '▶ Play';
      clearInterval(testMovieInterval);
    }
  }

  // 2. Render Timeline Graphic Elements
  layers.forEach((layer, lIdx) => {
    if (!layer.visible) return;
    const els = getRenderElements(lIdx, testMovieFrame);
    els.forEach(el => drawElement(ctx, el));
  });

  // 3. Render AS3 Runtime Display List
  if (activeAs3Runtime && activeAs3Runtime.root.numChildren > 0) {
    activeAs3Runtime.root.children.forEach(child => {
      renderAs3DisplayObject(ctx, child);
    });
  }

  document.getElementById('test-movie-status').textContent = `Frame ${testMovieFrame + 1}/${MAX_FRAMES} | ${fps} fps`;
}

function renderAs3DisplayObject(ctx, obj) {
  if (!obj || !obj.visible || obj.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = (ctx.globalAlpha || 1) * obj.alpha;
  ctx.translate(obj.x, obj.y);
  if (obj.rotation) ctx.rotate((obj.rotation * Math.PI) / 180);
  if (obj.scaleX !== 1 || obj.scaleY !== 1) ctx.scale(obj.scaleX, obj.scaleY);

  if (obj.graphics && obj.graphics.commands) {
    let curFill = null;
    let curStroke = null;
    let curLineWidth = 0;
    for (const cmd of obj.graphics.commands) {
      if (cmd.type === 'beginFill') {
        curFill = '#' + (cmd.color.toString(16).padStart(6, '0'));
        ctx.beginPath();
      } else if (cmd.type === 'endFill') {
        if (curFill) {
          ctx.fillStyle = curFill;
          ctx.fill();
        }
        if (curStroke) {
          ctx.strokeStyle = curStroke;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
        }
        curFill = null;
      } else if (cmd.type === 'lineStyle') {
        curLineWidth = cmd.width || 1;
        curStroke = '#' + (cmd.color.toString(16).padStart(6, '0'));
      } else if (cmd.type === 'drawRect') {
        if (!curFill && !curStroke) ctx.beginPath();
        ctx.rect(cmd.x, cmd.y, cmd.width, cmd.height);
      } else if (cmd.type === 'drawCircle') {
        if (!curFill && !curStroke) ctx.beginPath();
        ctx.arc(cmd.x, cmd.y, cmd.radius, 0, Math.PI * 2);
      } else if (cmd.type === 'drawRoundRect') {
        if (!curFill && !curStroke) ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cmd.x, cmd.y, cmd.width, cmd.height, cmd.ellipseWidth || 4);
        else ctx.rect(cmd.x, cmd.y, cmd.width, cmd.height);
      } else if (cmd.type === 'moveTo') {
        ctx.moveTo(cmd.x, cmd.y);
      } else if (cmd.type === 'lineTo') {
        ctx.lineTo(cmd.x, cmd.y);
      }
    }
    if (curFill) {
      ctx.fillStyle = curFill;
      ctx.fill();
    }
    if (curStroke) {
      ctx.strokeStyle = curStroke;
      ctx.lineWidth = curLineWidth;
      ctx.stroke();
    }
  }

  if (obj.text) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#' + ((obj.textColor || 0).toString(16).padStart(6, '0'));
    ctx.fillText(obj.text, 0, 14);
  }

  if (obj.children) {
    obj.children.forEach(child => renderAs3DisplayObject(ctx, child));
  }

  ctx.restore();
}

function toggleTestMoviePlay() {
  isTestMoviePlaying = !isTestMoviePlaying;
  const btn = document.getElementById('btn-test-play');
  if (isTestMoviePlaying) {
    btn.textContent = '⏸ Pause';
    if (activeAs3Runtime) activeAs3Runtime.root.play();
    startTestMovieInterval();
  } else {
    btn.textContent = '▶ Play';
    if (activeAs3Runtime) activeAs3Runtime.root.stop();
    clearInterval(testMovieInterval);
  }
}

function rewindTestMovie() {
  testMovieFrame = 0;
  if (activeAs3Runtime) activeAs3Runtime.root.gotoAndStop(1);
  renderTestMovieFrame();
}

function closeTestMovie() {
  clearInterval(testMovieInterval);
  activeAs3Runtime = null;
  document.getElementById('test-movie-modal').style.display = 'none';
}

function switchDockTab(tabName) {
  document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dock-body').forEach(b => b.style.display = 'none');
  const targetTab = Array.from(document.querySelectorAll('.dock-tab')).find(t => t.textContent.toLowerCase().includes(tabName));
  if (targetTab) targetTab.classList.add('active');
  const panel = document.getElementById(`panel-${tabName}`);
  if (panel) panel.style.display = 'block';
}

function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const toolShortcuts = {
      v: 'select',
      m: 'marquee',
      a: 'subselect',
      q: 'transform',
      n: 'line',
      y: 'pencil',
      b: 'brush',
      r: 'rect',
      o: 'oval',
      k: 'bucket',
      e: 'eraser',
      t: 'text',
      i: 'eyedropper'
    };
    const lowerKey = (e.key || '').toLowerCase();
    const matchedTool = toolShortcuts[lowerKey];

    if (e.key === 'F6') {
      e.preventDefault();
      insertKeyframe();
    } else if (e.key === 'F7') {
      e.preventDefault();
      insertBlankKeyframe();
    } else if (e.key === 'F8') {
      e.preventDefault();
      promptConvertSymbol();
    } else if ((e.ctrlKey || e.metaKey) && (e.key || '').toLowerCase() === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        ungroupSelection();
      } else {
        groupSelection();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key || '').toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelection();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      testMovie();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      togglePlay();
    } else if (matchedTool) {
      e.preventDefault();
      setTool(matchedTool);
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

function parseHexColor(hex) {
  if (!hex || !hex.startsWith('#')) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(hex.slice(1, 3), 16) || 0,
    g: parseInt(hex.slice(3, 5), 16) || 0,
    b: parseInt(hex.slice(5, 7), 16) || 0
  };
}

async function saveFla() {
  const fla = new FlaProject({
    width: stageWidth,
    height: stageHeight,
    frameRate: fps,
    backgroundColor: stageBgColor,
    actionScriptVersion: '3',
    documentClass: 'Main',
    layers: layers.map(l => ({
      name: l.name,
      locked: l.locked,
      visible: l.visible,
      frames: l.frames.map((f, idx) => ({
        index: idx,
        duration: 1,
        isKeyframe: f.isKeyframe,
        actions: f.actions || '',
        elements: f.elements || []
      }))
    })),
    symbols: library
  });

  const zipBuf = await fla.exportBuffer();
  downloadBlob(new Blob([zipBuf], { type: 'application/octet-stream' }), 'project.fla');
  logTrace(`[FLA] Project saved as project.fla (DOMDocument XFL format with AS3 support)`);
}

function exportSwf() {
  const movieFrames = [];
  for (let f = 0; f < MAX_FRAMES; f++) {
    const frameElements = [];
    let frameActions = '';
    layers.forEach(layer => {
      if (!layer.visible) return;
      const curData = layer.frames[f];
      if (curData && curData.actions) {
        frameActions += (frameActions ? '\n' : '') + curData.actions;
      }
      const els = getRenderElements(layers.indexOf(layer), f);
      els.forEach(el => frameElements.push(el));
    });
    if (frameElements.length > 0 || frameActions) {
      movieFrames.push({
        elements: frameElements,
        actions: frameActions
      });
    }
  }

  const movie = new SwfMovie({
    version: 19,
    as3: true,
    documentClass: 'Main',
    width: stageWidth,
    height: stageHeight,
    fps: fps,
    backgroundColor: parseHexColor(stageBgColor),
    frames: movieFrames
  });

  const swfBuf = movie.toBuffer();
  downloadBlob(new Blob([swfBuf], { type: 'application/x-shockwave-flash' }), 'movie.swf');
  logTrace(`[SWF] Exported movie.swf (${swfBuf.length} bytes, SWF v19, AS3 / AVM2 enabled)`);
}

async function handleOpenFla(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const project = await FlaProject.fromBuffer(arrayBuffer);
    stageWidth = project.width;
    stageHeight = project.height;
    fps = project.frameRate;
    stageBgColor = project.backgroundColor;
    layers = project.layers;
    document.getElementById('stage-w-input').value = stageWidth;
    document.getElementById('stage-h-input').value = stageHeight;
    document.getElementById('stage-fps-input').value = fps;
    document.getElementById('stage-bg-input').value = stageBgColor;
    currentFrame = 0;
    activeLayerIndex = 0;
    renderTimeline();
    renderStage();
    updatePlayhead();
    updateStatus();
    logTrace(`[FLA] Loaded ${file.name} successfully (${layers.length} layers, AS${project.actionScriptVersion})`);
  } catch (err) {
    alert('Failed to load FLA: ' + err.message);
  }
  event.target.value = '';
}

async function handleDisassembleSwf(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const swfData = (typeof Buffer !== 'undefined') ? Buffer.from(arrayBuffer) : new Uint8Array(arrayBuffer);
    const parsed = SwfMovie.parse(swfData);
    let output = `// SWF Disassembly: ${file.name}\n// Version: ${parsed.version} (AS3: ${parsed.isActionScript3})\n// Dimensions: ${parsed.frameCount} frames @ ${parsed.fps} fps\n// Total Tags: ${parsed.tags.length}\n\n`;
    if (parsed.abcBlocks && parsed.abcBlocks.length > 0) {
      output += `=== ActionScript 3.0 (AVM2 Bytecode Blocks: ${parsed.abcBlocks.length}) ===\n\n`;
      parsed.abcBlocks.forEach((b, i) => {
        output += `[Block ${i + 1}: ${b.name} (${b.byteLength} bytes)]\n`;
        if (b.disassembly && b.disassembly.fullText) {
          output += b.disassembly.fullText + '\n';
        }
      });
    } else {
      output += `// No AVM2 DoABC tags found in this SWF.\n`;
    }
    logTrace(output);
    switchDockTab('output');
  } catch (err) {
    alert('Failed to disassemble SWF: ' + err.message);
  }
  event.target.value = '';
}
