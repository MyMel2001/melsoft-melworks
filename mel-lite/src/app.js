// MelLite Studio Client Application Engine
const { MelLiteFilterEngine } = require('./filters');

let currentImage = null; // { width, height, data }
let adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 } };

const canvas = document.getElementById('ml-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const maxW = 1600;
  const maxH = 1600;
  let w = currentImage ? currentImage.width : 800;
  let h = currentImage ? currentImage.height : 600;
  const scale = Math.min(1, maxW / w, maxH / h);
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);
}

function renderImage() {
  if (!currentImage) return;
  resizeCanvas();
  ctx.putImageData(new ImageData(currentImage.data, currentImage.width, currentImage.height), 0, 0);
  // Draw scaled to canvas backing store
  ctx.save();
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function handleImageFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const data = new Uint8ClampedArray(w * h * 4);
      // draw to offscreen canvas to get pixel data
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const offCtx = off.getContext('2d');
      offCtx.drawImage(img, 0, 0);
      currentImage = { width: w, height: h, data: offCtx.getImageData(0, 0, w, h).data };
      adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 } };
      updateSliders();
      renderImage();
      updateStatus();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function applyAdjustments() {
  if (!currentImage) {
    alert('Open an image first.');
    return;
  }
  currentImage = { ...currentImage, data: MelLiteFilterEngine.apply(currentImage, adjustments).data };
  renderImage();
  updateStatus();
}

function resetAdjustments() {
  adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 } };
  updateSliders();
}

function updateSliders() {
  document.getElementById('ml-exp').value = adjustments.exposure;
  document.getElementById('ml-exp-val').textContent = adjustments.exposure;
  document.getElementById('ml-contrast').value = adjustments.contrast;
  document.getElementById('ml-contrast-val').textContent = adjustments.contrast;
  document.getElementById('ml-brightness').value = adjustments.brightness;
  document.getElementById('ml-brightness-val').textContent = adjustments.brightness;
  document.getElementById('ml-saturation').value = (adjustments.saturation * 100);
  document.getElementById('ml-saturation-val').textContent = Math.round(adjustments.saturation * 100) + '%';
  document.getElementById('ml-wb-r').value = adjustments.whiteBalance.r;
  document.getElementById('ml-wb-g').value = adjustments.whiteBalance.g;
  document.getElementById('ml-wb-b').value = adjustments.whiteBalance.b;
}

function updateExposure(val) { adjustments.exposure = parseFloat(val) || 0; document.getElementById('ml-exp-val').textContent = val; }
function updateContrast(val) { adjustments.contrast = parseInt(val, 10) || 0; document.getElementById('ml-contrast-val').textContent = val; }
function updateBrightness(val) { adjustments.brightness = parseInt(val, 10) || 0; document.getElementById('ml-brightness-val').textContent = val; }
function updateSaturation(val) { adjustments.saturation = parseInt(val, 10) / 100; document.getElementById('ml-saturation-val').textContent = val + '%'; }
function updateWhiteBalance() {
  adjustments.whiteBalance = {
    r: parseFloat(document.getElementById('ml-wb-r').value) || 1,
    g: parseFloat(document.getElementById('ml-wb-g').value) || 1,
    b: parseFloat(document.getElementById('ml-wb-b').value) || 1
  };
}

function updateStatus() {
  document.getElementById('ml-status').textContent = currentImage ? 'MelLite | ' + currentImage.width + 'x' + currentImage.height : 'MelLite | No image open';
}

function triggerOpen() {
  document.getElementById('ml-file-input').click();
}

function exportPng() {
  if (!currentImage) { alert('Open an image first.'); return; }
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = currentImage.width;
  exportCanvas.height = currentImage.height;
  const exportCtx = exportCanvas.getContext('2d');
  exportCtx.putImageData(new ImageData(currentImage.data, currentImage.width, currentImage.height), 0, 0);
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mel-lite-export.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
