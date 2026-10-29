// MelFilm Studio Client Application Engine
const { MelFfmpeg } = require('./ffmpeg');
const { MelFilmBundle } = require('./bundle');
const { MelFilmComp } = require('./comp');
const { MelFilmTimeline } = require('./timeline');
const { getTransition, XFADE_TRANSITIONS } = require('./transitions');

let currentVideo = null; // { name, path, url }
let currentComp = null;
let mfTweenLayerId = null;
let mfTweenFrame = 0;

function updateStatus() {
  document.getElementById('mf-status').textContent = currentVideo ? 'MelFilm | ' + currentVideo.name : 'MelFilm | No video open';
}

function triggerOpen() {
  document.getElementById('mf-file-input').click();
}

function handleVideoFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  currentVideo = { name: file.name, path: file.path || '', url: URL.createObjectURL(file) };
  const video = document.getElementById('mf-video');
  video.src = currentVideo.url;
  updateStatus();
}

async function exportVideo() {
  if (!currentVideo) {
    alert('Open a video first.');
    return;
  }
  const resolution = document.getElementById('mf-resolution').value;
  const format = document.getElementById('mf-format').value;
  const fps = parseInt(document.getElementById('mf-fps').value) || 30;
  const outputPath = '/tmp/mel-film-render-' + Date.now() + '.' + format;
  try {
    const res = await MelFfmpeg.exportVideo({ inputPath: currentVideo.path, outputPath, resolution, format, fps });
    alert('Render complete: ' + outputPath + ' (' + res.code + ')');
  } catch (err) {
    alert('Render failed: ' + err.message);
  }
}

function getMfTimeline() {
  const comp = getMfComp();
  const timeline = MelFilmTimeline.create(comp.name, comp.frameRate);
  const track = timeline.addTrack('Video', 'video');
  comp.layers.forEach((l) => {
    const lastFrame = (l.keyframes || []).reduce((m, k) => Math.max(m, Number(k.frame) || 0), 0);
    timeline.addClip(track.id, l.source, 0, lastFrame);
  });
  return timeline;
}

function readMfGrade() {
  const brightnessEl = document.getElementById('mf-grade-brightness');
  const contrastEl = document.getElementById('mf-grade-contrast');
  const saturationEl = document.getElementById('mf-grade-saturation');
  const hueEl = document.getElementById('mf-grade-hue');
  const grade = {};
  const brightness = brightnessEl ? parseFloat(brightnessEl.value) : NaN;
  const contrast = contrastEl ? parseFloat(contrastEl.value) : NaN;
  const saturation = saturationEl ? parseFloat(saturationEl.value) : NaN;
  const hue = hueEl ? parseFloat(hueEl.value) : NaN;
  if (Number.isFinite(brightness)) grade.brightness = brightness;
  if (Number.isFinite(contrast)) grade.contrast = contrast;
  if (Number.isFinite(saturation)) grade.saturation = saturation;
  if (Number.isFinite(hue)) grade.hue = hue;
  return grade;
}

async function exportMfTimeline() {
  const comp = getMfComp();
  const timeline = getMfTimeline();
  const format = document.getElementById('mf-format').value;
  const outputPath = '/tmp/mel-film-timeline-' + Date.now() + '.' + format;
  try {
    const res = await MelFfmpeg.renderTimeline({
      timeline,
      outputPath,
      resolution: document.getElementById('mf-resolution').value,
      fps: parseInt(document.getElementById('mf-fps').value) || comp.frameRate,
      format: format,
      transition: document.getElementById('mf-transition').value,
      transitionDuration: parseFloat(document.getElementById('mf-transition-duration').value) || 1,
      grade: readMfGrade()
    });
    alert('Timeline render complete: ' + outputPath + ' (' + res.code + ')');
  } catch (err) {
    alert('Timeline render failed: ' + (err && err.message ? err.message : err));
  }
}


async function capturePoster() {
  if (!currentVideo) {
    alert('Open a video first.');
    return;
  }
  const outputPath = '/tmp/mel-film-poster-' + Date.now() + '.png';
  await MelFfmpeg.capturePoster({ inputPath: currentVideo.path, outputPath, timeSeconds: 1 });
  alert('Poster saved: ' + outputPath);
}

function updateMfTransition(value) {
  const el = document.getElementById('mf-transition');
  if (el) el.value = value || 'none';
}

function updateMfTransitionDuration(value) {
  const el = document.getElementById('mf-transition-duration');
  if (el) el.value = String(value ?? 1);
}

function addMfLayerWithSource(source) {
  const comp = getMfComp();
  comp.addLayer('Layer ' + (comp.layers.length + 1), source);
  renderMfComps();
}

function onMfLayerSource(event) {
  const file = event.target.files[0];
  if (!file) return;
  const source = file.path || '';
  if (!source) { alert('Layer source requires a file system path.'); return; }
  addMfLayerWithSource(source);
}

async function crossfadeMfLayers() {
  const comp = getMfComp();
  const sources = comp.layers.map((l) => ({ id: l.id, name: l.name, path: l.source })).filter((x) => x.path);
  if (sources.length < 2) {
    alert('Add two layers with source media first.');
    return;
  }
  const transition = getMfTransition();
  if (transition === 'none') { alert('Pick a transition before crossfading.'); return; }
  const tr = getTransition(transition);
  const duration = parseFloat(document.getElementById('mf-transition-duration').value) || 1;
  const outputPath = '/tmp/mel-film-xfade-' + Date.now() + '.mp4';
  try {
    const res = await MelFfmpeg.crossfade({
      inputs: [
        { inputPath: sources[0].path, duration: duration },
        { inputPath: sources[1].path, duration: duration }
      ],
      outputPath,
      transition: tr.filter,
      duration
    });
    alert('Crossfade complete: ' + outputPath + ' (' + (res && res.code) + ')');
  } catch (err) {
    alert('Crossfade failed: ' + (err && err.message ? err.message : err));
  }
}

function updateMfPreset(value) {
  const presets = {
    '4k-tv': { resolution: '3840x2160', fps: 24 },
    '1080p-tv': { resolution: '1920x1080', fps: 24 },
    'youtube': { resolution: '1920x1080', fps: 30 },
    'custom': { resolution: '1920x1080', fps: 30 }
  };
  const preset = presets[value] || presets['custom'];
  if (value !== 'custom') {
    document.getElementById('mf-resolution').value = preset.resolution;
    document.getElementById('mf-fps').value = preset.fps;
  }
}

function switchMfTab(tab) {
  document.getElementById('mf-panel-edit').classList.toggle('mf-hidden', tab !== 'edit');
  document.getElementById('mf-panel-render').classList.toggle('mf-hidden', tab !== 'render');
  document.getElementById('mf-panel-comps').classList.toggle('mf-hidden', tab !== 'comps');
  if (tab === 'comps') renderMfComps();
}

async function saveMfBundle() {
  if (!currentVideo) {
    alert('Open a video first.');
    return;
  }
  const format = document.getElementById('mf-bundle-format').value;
  const projectName = (document.getElementById('mf-bundle-name') || {}).value || currentVideo.name;
  const xml = '<?xml version="1.0"?><Project><Name>' + projectName + '</Name></Project>';
  let buf;
  if (format === 'prproj') {
    buf = await MelFilmBundle.savePrproj(projectName, xml);
  } else {
    buf = await MelFilmBundle.saveAepx(projectName, xml);
  }
  const blob = new Blob([buf], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mel-film-bundle.' + (format === 'prproj' ? 'prproj' : 'aepx');
  a.click();
  URL.revokeObjectURL(url);
}

async function loadMfBundle(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const buf = Uint8Array.from(atob(e.target.result.split(',')[1] || ''), (c) => c.charCodeAt(0));
    const result = await MelFilmBundle.loadBundle(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const names = Object.keys(result.files || {});
    alert('MelFilm bundle loaded: ' + names.join(', '));
  };
  reader.readAsDataURL(file);
}

function getMfComp() {
  if (!currentComp) currentComp = MelFilmComp.create('Comp');
  return currentComp;
}

function createMfComp() {
  currentComp = MelFilmComp.create('Comp ' + (MelFilmComp.layerSeq + 1));
  mfTweenLayerId = null;
  mfTweenFrame = 0;
  renderMfComps();
}

function addMfLayer() {
  const comp = getMfComp();
  comp.addLayer('Layer ' + (comp.layers.length + 1));
  renderMfComps();
}

function removeMfLayer(layerId) {
  const comp = getMfComp();
  comp.removeLayer(layerId);
  renderMfComps();
}

function renderMfComps() {
  const comp = getMfComp();
  document.getElementById('mf-comp-name').textContent = comp.name;
  const listEl = document.getElementById('mf-layer-list');
  if (comp.layers.length === 0) {
    listEl.innerHTML = '<div class="mf-layer-empty">No layers in comp.</div>';
  } else {
    listEl.innerHTML = comp.layers.map((l) => '<div class="mf-layer-row">' + l.name + (l.source ? ' [' + l.source + ']' : '') + ' <button class="mf-layer-remove" onclick="removeMfLayer(\'' + l.id + '\')">x</button></div>').join('');
  }
  renderMfTweenPanel();
}

// --- MelFilm layer tween panel ---

function getMfTweenLayer() {
  const comp = getMfComp();
  return comp.getLayer(mfTweenLayerId) || comp.layers[0] || null;
}

function mfTweenFrameMax() {
  const comp = getMfComp();
  const kfMax = comp.layers.reduce((m, l) => l.keyframes.reduce((mm, k) => Math.max(mm, k.frame), m), 0);
  // ponytail: default 60-frame work area until comps get an explicit duration control.
  return Math.max(comp.frameCount, kfMax, 60);
}

function renderMfTweenPanel() {
  const comp = getMfComp();
  const select = document.getElementById('mf-tween-layer');
  if (!select) return;
  const layer = getMfTweenLayer();
  mfTweenLayerId = layer ? layer.id : null;
  select.innerHTML = comp.layers.length === 0
    ? '<option value="">No layers</option>'
    : comp.layers.map((l) => '<option value="' + l.id + '"' + (layer && l.id === layer.id ? ' selected' : '') + '>' + l.name + '</option>').join('');
  const scrub = document.getElementById('mf-tween-frame');
  scrub.max = String(mfTweenFrameMax());
  if (parseInt(scrub.value, 10) > parseInt(scrub.max, 10)) scrub.value = scrub.max;
  mfTweenFrame = parseInt(scrub.value, 10) || 0;
  updateMfTweenTime();
  updateMfTweenInputs();
  renderMfKeyframeList();
  renderMfCompPreview();
}

function selectMfTweenLayer(layerId) {
  mfTweenLayerId = layerId;
  updateMfTweenInputs();
  renderMfKeyframeList();
  renderMfCompPreview();
}

function setMfTweenFrame(value) {
  mfTweenFrame = parseInt(value, 10) || 0;
  const scrub = document.getElementById('mf-tween-frame');
  if (scrub) scrub.value = String(mfTweenFrame);
  updateMfTweenTime();
  updateMfTweenInputs();
  renderMfCompPreview();
}

function updateMfTweenTime() {
  const comp = getMfComp();
  const seconds = comp.frameRate > 0 ? mfTweenFrame / comp.frameRate : 0;
  document.getElementById('mf-tween-time').textContent = 'f ' + mfTweenFrame + ' | ' + seconds.toFixed(2) + 's';
}

function updateMfTweenInputs() {
  const comp = getMfComp();
  const props = mfTweenLayerId ? comp.sampleLayer(mfTweenLayerId, mfTweenFrame) : null;
  if (!props) return;
  document.getElementById('mf-tween-x').value = Math.round(props.x * 100) / 100;
  document.getElementById('mf-tween-y').value = Math.round(props.y * 100) / 100;
  document.getElementById('mf-tween-scale').value = Math.round(props.scale * 1000) / 1000;
  document.getElementById('mf-tween-rotation').value = Math.round(props.rotation * 100) / 100;
  document.getElementById('mf-tween-opacity').value = Math.round(props.opacity * 1000) / 1000;
}

function readMfTweenInputs() {
  return {
    x: parseFloat(document.getElementById('mf-tween-x').value) || 0,
    y: parseFloat(document.getElementById('mf-tween-y').value) || 0,
    scale: parseFloat(document.getElementById('mf-tween-scale').value) || 1,
    rotation: parseFloat(document.getElementById('mf-tween-rotation').value) || 0,
    opacity: parseFloat(document.getElementById('mf-tween-opacity').value)
  };
}

function addMfKeyframe() {
  const comp = getMfComp();
  const layer = getMfTweenLayer();
  if (!layer) { alert('Add a layer first.'); return; }
  const easing = document.getElementById('mf-tween-easing').value;
  comp.addKeyframe(layer.id, mfTweenFrame, readMfTweenInputs(), easing);
  if (mfTweenFrame > comp.frameCount) comp.frameCount = mfTweenFrame;
  renderMfTweenPanel();
}

function deleteMfKeyframe() {
  const comp = getMfComp();
  const layer = getMfTweenLayer();
  if (!layer) return;
  if (comp.removeKeyframe(layer.id, mfTweenFrame) === 0) alert('No keyframe at frame ' + mfTweenFrame + '.');
  renderMfTweenPanel();
}

function renderMfKeyframeList() {
  const listEl = document.getElementById('mf-keyframe-list');
  const comp = getMfComp();
  const layer = getMfTweenLayer();
  const kfs = layer && Array.isArray(layer.keyframes) ? layer.keyframes : [];
  if (kfs.length === 0) {
    listEl.innerHTML = '<div class="mf-layer-empty">No keyframes on this layer.</div>';
    return;
  }
  listEl.innerHTML = kfs.map((k) => {
    const seconds = comp.frameRate > 0 ? k.frame / comp.frameRate : 0;
    const active = k.frame === mfTweenFrame ? ' mf-keyframe-active' : '';
    return '<div class="mf-keyframe-row' + active + '" onclick="setMfTweenFrame(' + k.frame + ')">' +
      '<span>f ' + k.frame + ' | ' + seconds.toFixed(2) + 's</span><span>' + k.easing + '</span></div>';
  }).join('');
}

function renderMfCompPreview() {
  const canvas = document.getElementById('mf-tween-canvas');
  if (!canvas || !canvas.getContext) return;
  const comp = getMfComp();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const fit = Math.min(canvas.width / comp.width, canvas.height / comp.height);
  ctx.save();
  ctx.scale(fit, fit);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(0.5, 0.5, comp.width - 1, comp.height - 1);
  const boxW = comp.width / 3;
  const boxH = comp.height / 3;
  comp.layers.forEach((l, i) => {
    const props = comp.sampleLayer(l.id, mfTweenFrame) || {};
    ctx.save();
    ctx.translate(comp.width / 2 + (props.x || 0) * comp.width, comp.height / 2 + (props.y || 0) * comp.height);
    ctx.rotate((props.rotation || 0) * Math.PI / 180);
    ctx.scale(props.scale === undefined ? 1 : props.scale, props.scale === undefined ? 1 : props.scale);
    ctx.globalAlpha = props.opacity === undefined ? 1 : props.opacity;
    ctx.fillStyle = i % 2 === 0 ? '#f87171' : '#3b82f6';
    ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f172a';
    ctx.font = Math.round(boxH / 8) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.name + (l.source ? ' [' + l.source + ']' : ''), 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

async function renderMfTween() {
  const comp = getMfComp();
  const layer = getMfTweenLayer();
  if (!layer) { alert('Add a layer first.'); return; }
  const inputPath = layer.source || (currentVideo ? currentVideo.path : '');
  if (!inputPath) { alert('Layer has no source video. Set a layer source or open a video first.'); return; }
  const outputPath = '/tmp/mel-film-tween-' + Date.now() + '.mp4';
  try {
    await MelFfmpeg.renderTween({
      inputPath,
      outputPath,
      keyframes: layer.keyframes,
      frameRate: comp.frameRate,
      width: comp.width,
      height: comp.height
    });
    alert('Tween rendered: ' + outputPath);
  } catch (err) {
    alert('Tween render failed: ' + err.message);
  }
}
