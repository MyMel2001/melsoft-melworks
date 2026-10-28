// MelSound Studio Client Application Engine
const { MelSoundProject } = require('./project');

let currentProject = null;

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
