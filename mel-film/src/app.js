// MelFilm Studio Client Application Engine
const { MelFfmpeg } = require('./ffmpeg');

let currentVideo = null; // { name, path, url }

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
