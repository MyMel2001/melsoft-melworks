// MelSound Studio Client Application Engine
const { MelSoundProject } = require('./project');
const { MelSoundPlayer } = require('./audio');
const { MelFlsWriter, MelFlsReader } = require('./flp');
const { saveWav: saveMelSoundWav } = require('./wav');

let currentProject = null;
let player = new MelSoundPlayer();

function updateStatus() {
  document.getElementById('ms-status').textContent = currentProject ? 'MelSound | BPM ' + currentProject.bpm : 'MelSound | No project open';
}

function newProject() {
  currentProject = new MelSoundProject();
  document.getElementById('ms-bpm').value = currentProject.bpm;
  document.getElementById('ms-gain').value = currentProject.masterGain;
  refreshMelSoundGui();
  updateStatus();
}

function refreshMelSoundGui() {
  renderPatternsGui();
  renderChainGui();
  renderTracksGui();
  const sel = document.getElementById('ms-pattern-select');
  renderStepGrid(sel && sel.value ? sel.value : (currentProject && currentProject.patterns.length > 0 ? currentProject.patterns[0].id : null));
}

function renderTracksGui() {
  const el = document.getElementById('ms-tracks');
  if (!el) return;
  const tracks = (currentProject && currentProject.tracks) || [];
  if (tracks.length === 0) {
    el.innerHTML = '<div class="ms-grid-empty">No tracks.</div>';
    return;
  }
  el.innerHTML = tracks.map((t) => {
    const safeId = t.id.replace(/'/g, '');
    const vol = t.volume === undefined ? 1 : t.volume;
    return '<div class="ms-track-row">' +
      '<span>' + (t.name || '') + '</span>' +
      '<input type="checkbox" class="ms-track-mute" onchange="toggleTrackMuteGui(\'' + safeId + '\')" ' + (t.mute ? 'checked' : '') + '>' +
      '<input type="number" class="ms-track-vol" id="ms-track-vol-' + safeId + '" value="' + vol + '" min="0" max="4" step="0.01" oninput="setTrackVolumeGui(\'' + safeId + '\', this.value)">' +
      '</div>';
  }).join('');
}

function updateSwingGui(val) {
  if (!currentProject) newProject();
  currentProject.setSwing(parseInt(val) || 0);
}

function setTrackVolumeGui(trackId, value) {
  if (!currentProject) return;
  currentProject.setTrackVolume(trackId, parseFloat(value) || 0);
}

function toggleTrackMuteGui(trackId) {
  if (!currentProject) return;
  const track = (currentProject.tracks || []).find((t) => t.id === trackId);
  if (!track) return;
  currentProject.setTrackMute(trackId, !track.mute);
}

function renderChainGui() {
  const listEl = document.getElementById('ms-chain-list');
  if (!listEl) return;
  const chainIds = (currentProject && currentProject.patternChain) || [];
  if (chainIds.length === 0) {
    listEl.innerHTML = '<div class="ms-grid-empty">Chain empty.</div>';
    return;
  }
  listEl.innerHTML = chainIds.map((id) => {
    const p = (currentProject.patterns || []).find((x) => x.id === id);
    const name = p ? p.name : id;
    const safeId = id.replace(/'/g, '');
    return '<div class="ms-chain-row">' + name + ' <button class="ms-btn ms-btn-sm" onclick="removePatternFromChainGui(\'' + safeId + '\')">x</button></div>';
  }).join('');
}

function addSelectedPatternToChain() {
  if (!currentProject) return;
  const sel = document.getElementById('ms-pattern-select');
  const value = sel ? sel.value : '';
  if (!value) { alert('Select a pattern first.'); return; }
  currentProject.addPatternToChain(value);
  renderChainGui();
}

function removePatternFromChainGui(patternId) {
  if (!currentProject) return;
  if (patternId) currentProject.removePatternFromChain(patternId);
  renderChainGui();
}

function triggerOpen() {
  document.getElementById('ms-file-input').click();
}

function handleProjectFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      currentProject = MelSoundProject.deserialize(e.target.result);
      document.getElementById('ms-bpm').value = currentProject.bpm;
      document.getElementById('ms-gain').value = currentProject.masterGain;
      refreshMelSoundGui();
      updateStatus();
    } catch (err) {
      alert('Failed to load MelSound project: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function saveProject() {
  if (!currentProject) {
    alert('Create or open a project first.');
    return;
  }
  const blob = new Blob([currentProject.serialize()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mel-sound-project.json';
  a.click();
  URL.revokeObjectURL(url);
}

function addTrack() {
  if (!currentProject) {
    newProject();
  }
  currentProject.addTrack('Track ' + (currentProject.tracks.length + 1));
}

function removeTrack() {
  if (!currentProject || currentProject.tracks.length === 0) return;
  currentProject.removeTrack(currentProject.tracks[currentProject.tracks.length - 1].id);
}

function setBpm() {
  const bpm = parseInt(document.getElementById('ms-bpm').value) || 120;
  if (!currentProject) newProject();
  currentProject.setBpm(bpm);
}

function updateBpm(val) {
  if (!currentProject) newProject();
  currentProject.setBpm(parseInt(val) || 120);
}

function updateGain(val) {
  if (!currentProject) newProject();
  currentProject.setMasterGain(parseFloat(val) || 1);
}

function playSequence() {
  if (!currentProject) newProject();
  const seq = player.play(currentProject);
  updateStatus();
  return seq;
}

function stopSequence() {
  player.stop();
  updateStatus();
}

function saveFls() {
  if (!currentProject) {
    alert('Create or open a project first.');
    return;
  }
  const writer = new MelFlsWriter();
  writer.addTempo(currentProject.bpm);
  writer.addKind(currentProject.kind);
  writer.addName('MelSound Project');
  currentProject.instruments.forEach((i) => writer.addInstrument(i));
  currentProject.patterns.forEach((p) => writer.addPattern(p));
  const buf = writer.build();
  const bin = Array.from(buf, (b) => String.fromCharCode(b)).join('');
  const blob = new Blob([bin], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mel-sound-project.flp';
  a.click();
  URL.revokeObjectURL(url);
}

function openFls(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    const parsed = MelFlsReader.parse(buf);
    const restoredPatterns = (parsed.patterns || []).map((p) => ({
      id: p.id,
      name: p.name,
      steps: p.steps || {}
    }));
    const restoredInstruments = (parsed.pluginStates || []).map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      params: i.params || {}
    }));
    currentProject = new MelSoundProject({
      bpm: parsed.bpm,
      kind: parsed.kind,
      instruments: restoredInstruments,
      patterns: restoredPatterns,
      patternChain: []
    });
    alert('FLP loaded: bpm=' + parsed.bpm + ' kind=' + parsed.kind + ' name=' + parsed.name + ' patterns=' + restoredPatterns.length + ' instruments=' + restoredInstruments.length);
    updateStatus();
  };
  reader.readAsArrayBuffer(file);
}

function saveWav() {
  if (!currentProject) {
    alert('Create or open a project first.');
    return;
  }
  const wavOutPath = '/tmp/mel-sound-export.wav';
  const wavWritten = saveMelSoundWav(currentProject, wavOutPath, 44100);
  alert('WAV exported: ' + wavOutPath + ' (' + wavWritten.length + ' bytes)');
}

function addPattern() {
  if (!currentProject) newProject();
  const pattern = currentProject.addPattern('Pattern ' + (currentProject.patterns.length + 1));
  refreshMelSoundGui();
  return pattern;
}

function deletePatternGui() {
  if (!currentProject) return;
  const sel = document.getElementById('ms-pattern-select');
  const patternId = sel ? sel.value : null;
  if (!patternId) return;
  currentProject.removePattern(patternId);
  refreshMelSoundGui();
}

function renderPatternsGui() {
  const sel = document.getElementById('ms-pattern-select');
  if (!sel) return;
  const patterns = (currentProject && currentProject.patterns) || [];
  sel.innerHTML = patterns.length === 0
    ? '<option value="">No patterns</option>'
    : patterns.map((p) => '<option value="' + p.id + '">' + p.name + '</option>').join('');
}

function onPatternSelectGui(value) {
  renderStepGrid(value);
}

function renderStepGrid(patternId) {
  const grid = document.getElementById('ms-step-grid');
  if (!grid) return;
  if (!currentProject || !patternId) {
    grid.innerHTML = '<div class="ms-grid-empty">No pattern selected.</div>';
    return;
  }
  const pattern = currentProject.getPattern(patternId);
  if (!pattern) {
    grid.innerHTML = '';
    return;
  }
  const tracks = currentProject.tracks || [];
  if (tracks.length === 0) {
    grid.innerHTML = '<div class="ms-grid-empty">Add tracks first.</div>';
    return;
  }
  let html = '<div class="ms-grid">';
  html += '<div class="ms-grid-row ms-grid-head">';
  html += '<div class="ms-grid-corner"></div>';
  for (let s = 0; s < 16; s++) html += '<div class="ms-grid-head">' + (s + 1) + '</div>';
  html += '</div>';
  for (const track of tracks) {
    const steps = pattern.steps[track.id] || new Array(16).fill(0);
    html += '<div class="ms-grid-row">';
    html += '<div class="ms-grid-label">' + track.name + '</div>';
    for (let s = 0; s < 16; s++) {
      const on = steps[s] ? ' ms-grid-cell-on' : '';
      html += '<button class="ms-grid-btn' + on + '" onclick="toggleStepGui(\'' + patternId + '\', \'' + track.id + '\', ' + s + ')">' + (steps[s] || '·') + '</button>';
    }
  }
  html += '</div>';
  grid.innerHTML = html;
}

function toggleStepGui(patternId, trackId, stepIdx) {
  if (!currentProject) return;
  const pattern = currentProject.getPattern(patternId);
  if (!pattern) return;
  if (!pattern.steps[trackId]) pattern.steps[trackId] = new Array(16).fill(0);
  const steps = pattern.steps[trackId];
  const idx = Math.max(0, Math.min(15, stepIdx));
  steps[idx] = steps[idx] ? 0 : 60;
}
