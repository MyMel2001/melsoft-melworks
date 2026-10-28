// MelLite Photo Development Filter Engine
// Professional-grade exposure, contrast, brightness, saturation, white balance, and curves adjustments.
const { createRequire } = require('module');
const path = require('path');
const melDrawRequire = createRequire(path.join(__dirname, '..', '..', 'mel-draw', 'package.json'));
const FilterEngine = melDrawRequire('./src/filters');

class MelLiteFilterEngine {
  // Exposure adjustment in stops (EV). 1 stop = double brightness.
  static applyExposure(imageData, ev = 0) {
    const data = imageData.data;
    const factor = Math.pow(2, ev);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor));
    }
    return imageData;
  }

  // Contrast adjustment around neutral gray (128).
  static applyContrast(imageData, contrast = 0) {
    const data = imageData.data;
    const scale = 1 + contrast / 255;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, 128 + (data[i] - 128) * scale));
      data[i + 1] = Math.max(0, Math.min(255, 128 + (data[i + 1] - 128) * scale));
      data[i + 2] = Math.max(0, Math.min(255, 128 + (data[i + 2] - 128) * scale));
    }
    return imageData;
  }

  // Brightness adjustment (additive offset, -255..255).
  static applyBrightness(imageData, brightness = 0) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + brightness));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness));
    }
    return imageData;
  }

  // Saturation adjustment (0..2 multiplier; 1.0 = neutral).
  static applySaturation(imageData, saturation = 1) {
    const data = imageData.data;
    const mult = Math.max(0, Math.min(2, saturation));
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const m = Math.max(r, g, b);
      data[i] = Math.max(0, Math.min(255, m + (r - m) * mult));
      data[i + 1] = Math.max(0, Math.min(255, m + (g - m) * mult));
      data[i + 2] = Math.max(0, Math.min(255, m + (b - m) * mult));
    }
    return imageData;
  }

  // White balance: per-channel gain multipliers around neutral (1.0).
  static applyWhiteBalance(imageData, gains = { r: 1, g: 1, b: 1 }) {
    const data = imageData.data;
    const gr = Math.max(0.1, gains.r || 1);
    const gg = Math.max(0.1, gains.g || 1);
    const gb = Math.max(0.1, gains.b || 1);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * gr));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * gg));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * gb));
    }
    return imageData;
  }

  // Full development pipeline: exposure -> contrast -> brightness -> saturation -> white balance -> curves.
  static apply(imageData, adjustments = {}) {
    let out = imageData;
    out = MelLiteFilterEngine.applyExposure(out, adjustments.exposure || 0);
    out = MelLiteFilterEngine.applyContrast(out, adjustments.contrast || 0);
    out = MelLiteFilterEngine.applyBrightness(out, adjustments.brightness || 0);
    out = MelLiteFilterEngine.applySaturation(out, adjustments.saturation === undefined ? 1 : adjustments.saturation);
    out = MelLiteFilterEngine.applyWhiteBalance(out, adjustments.whiteBalance || { r: 1, g: 1, b: 1 });
    if (adjustments.curves) {
      out = FilterEngine.applyCurves(out, adjustments.curves, 'rgb');
    }
    return out;
  }
}

module.exports = { MelLiteFilterEngine, FilterEngine };
