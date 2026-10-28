// MelFilm Studio Client Application Engine
const { MelFfmpeg } = require('./ffmpeg');
const { MelFilmBundle } = require('./bundle');
const { MelFilmComp } = require('./comp');

let currentVideo = null; // { name, path, url }
let currentComp = null;

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

async function capturePoster() {
  if (!currentVideo) {
    alert('Open a video first.');
    return;
  }
  const outputPath = '/tmp/mel-film-poster-' + Date.now() + '.png';
  await MelFfmpeg.capturePoster({ inputPath: currentVideo.path, outputPath, timeSeconds: 1 });
  alert('Poster saved: ' + outputPath);
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
    return;
  }
  listEl.innerHTML = comp.layers.map((l) => '<div class="mf-layer-row">' + l.name + ' <button class="mf-layer-remove" onclick="removeMfLayer(\'' + l.id + '\')">x</button></div>').join('');
}
