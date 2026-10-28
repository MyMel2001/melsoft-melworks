// MelLite Studio Client Application Engine
const { MelLiteFilterEngine } = require('./filters');
const { MelRawImportEngine } = require('./raw');

let currentImage = null; // { width, height, data }
let adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 }, crop: null, rotate: 0, sharpen: 0 };
let brush = { x: 0, y: 0, size: 20 };

const canvas = document.getElementById('ml-canvas');
const ctx = canvas.getContext('2d');
canvas.addEventListener('click', canvasClick);

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
      adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 }, crop: null, rotate: 0, sharpen: 0, local: null };
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
  const outImg = MelLiteFilterEngine.apply(currentImage, adjustments);
  currentImage = { width: outImg.width, height: outImg.height, data: outImg.data };
  renderImage();
  updateStatus();
}

function resetAdjustments() {
  adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 }, crop: null, rotate: 0, sharpen: 0, local: null };
  updateSliders();
}

function canvasClick(e) {
  if (!currentImage) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (currentImage.width / Math.max(1, rect.width)));
  const y = Math.round((e.clientY - rect.top) * (currentImage.height / Math.max(1, rect.height)));
  brush = { x: Math.max(0, Math.min(currentImage.width - 1, x)), y: Math.max(0, Math.min(currentImage.height - 1, y)), size: brush.size || 20 };
}

function updateBrushSize(val) { brush.size = parseInt(val, 10) || 20; document.getElementById('ml-brush-size-val').textContent = brush.size; }

function applyLocalNow() {
  if (!currentImage) { alert('Open an image first.'); return; }
  const size = Math.max(1, Math.round(brush.size) || 20);
  const half = Math.floor(size / 2);
  adjustments = { ...adjustments, local: { x: Math.max(0, brush.x - half), y: Math.max(0, brush.y - half), width: size, height: size } };
  applyAdjustments();
}

function applyCropNow() {
  if (!currentImage) {
    alert('Open an image first.');
    return;
  }
  const crop = {
    x: parseInt(document.getElementById('ml-crop-x').value) || 0,
    y: parseInt(document.getElementById('ml-crop-y').value) || 0,
    width: parseInt(document.getElementById('ml-crop-w').value) || currentImage.width,
    height: parseInt(document.getElementById('ml-crop-h').value) || currentImage.height
  };
  adjustments = { ...adjustments, crop };
  applyAdjustments();
}

function updateRotate(val) { adjustments.rotate = parseInt(val, 10) || 0; }
function updateSharpen(val) { adjustments.sharpen = parseFloat(val) || 0; }

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
  const crop = adjustments.crop || { x: 0, y: 0, width: currentImage ? currentImage.width : 0, height: currentImage ? currentImage.height : 0 };
  document.getElementById('ml-crop-x').value = crop.x;
  document.getElementById('ml-crop-y').value = crop.y;
  document.getElementById('ml-crop-w').value = crop.width;
  document.getElementById('ml-crop-h').value = crop.height;
  document.getElementById('ml-rotate').value = adjustments.rotate;
  document.getElementById('ml-sharpen').value = adjustments.sharpen;
  document.getElementById('ml-brush-size').value = brush.size;
}

function updateCropX(val) { if (adjustments.crop) adjustments.crop.x = parseInt(val, 10) || 0; }
function updateCropY(val) { if (adjustments.crop) adjustments.crop.y = parseInt(val, 10) || 0; }
function updateCropW(val) { if (adjustments.crop) adjustments.crop.width = parseInt(val, 10) || 0; }
function updateCropH(val) { if (adjustments.crop) adjustments.crop.height = parseInt(val, 10) || 0; }

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

async function importRawDng(event) {
  const file = event.target.files[0];
  if (!file) return;
  const buf = new Uint8Array(await file.arrayBuffer());
  const raw = MelRawImportEngine.parseDng(buf);
  const rgba = MelRawImportEngine.toRGBA(raw);
  currentImage = { width: rgba.width, height: rgba.height, data: rgba.data };
  adjustments = { exposure: 0, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 } };
  updateSliders();
  renderImage();
  updateStatus();
}

function triggerOpen() {
  document.getElementById('ml-file-input').click();
}

function exportStandardImage() {
  if (!currentImage) { alert('Open an image first.'); return; }
  const format = (document.getElementById('ml-export-format') || {}).value || 'png';
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = currentImage.width;
  exportCanvas.height = currentImage.height;
  const exportCtx = exportCanvas.getContext('2d');
  if (format === 'jpeg') {
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }
  exportCtx.putImageData(new ImageData(currentImage.data, currentImage.width, currentImage.height), 0, 0);
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mel-lite-export.' + format;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/' + format, format === 'jpeg' ? 0.92 : undefined);
}
