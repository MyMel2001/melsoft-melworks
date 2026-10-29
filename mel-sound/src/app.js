// MelSound Studio Client Application Engine
const { MelSoundProject } = require('./project');
const { MelSoundPlayer } = require('./audio');
const { MelFlsWriter, MelFlsReader } = require('./flp');

let currentProject = null;
let player = new MelSoundPlayer();

function updateStatus() {
  document.getElementById('ms-status').textContent = currentProject ? 'MelSound | BPM ' + currentProject.bpm : 'MelSound | No project open';
}

function newProject() {
  currentProject = new MelSoundProject();
  document.getElementById('ms-bpm').value = currentProject.bpm;
  document.getElementById('ms-gain').value = currentProject.masterGain;
  updateStatus();
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
    currentProject = new MelSoundProject({
      bpm: parsed.bpm,
      kind: parsed.kind,
      patterns: restoredPatterns,
      patternChain: []
    });
    alert('FLP loaded: bpm=' + parsed.bpm + ' kind=' + parsed.kind + ' name=' + parsed.name + ' patterns=' + restoredPatterns.length);
    updateStatus();
  };
  reader.readAsArrayBuffer(file);
}
