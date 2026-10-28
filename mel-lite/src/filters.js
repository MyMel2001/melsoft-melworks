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
    if (adjustments.crop) {
      out = MelLiteFilterEngine.applyCrop(out, adjustments.crop);
    }
    if (adjustments.rotate) {
      out = MelLiteFilterEngine.applyRotate(out, adjustments.rotate);
    }
    if (adjustments.sharpen !== undefined) {
      out = MelLiteFilterEngine.applySharpen(out, adjustments.sharpen);
    }
    return out;
  }

  // Crop to region { x, y, width, height } (pixels, origin top-left).
  static applyCrop(imageData, crop = { x: 0, y: 0, width: 0, height: 0 }) {
    const src = imageData.data;
    const sw = imageData.width;
    const sh = imageData.height;
    const cw = Math.max(1, Math.round(crop.width) || sw);
    const ch = Math.max(1, Math.round(crop.height) || sh);
    const cx = Math.max(0, Math.min(Math.round(crop.x) || 0, Math.max(0, sw - cw)));
    const cy = Math.max(0, Math.min(Math.round(crop.y) || 0, Math.max(0, sh - ch)));
    const out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((cy + y) * sw + (cx + x)) * 4;
        const di = (y * cw + x) * 4;
        out[di] = src[si];
        out[di + 1] = src[si + 1];
        out[di + 2] = src[si + 2];
        out[di + 3] = src[si + 3];
      }
    }
    return { width: cw, height: ch, data: out };
  }

  // Rotate by 90/180/270 degrees (clockwise) around center; returns new dims.
  static applyRotate(imageData, rotation = 90) {
    const src = imageData.data;
    const sw = imageData.width;
    const sh = imageData.height;
    const turns = (((Math.round(rotation) % 360) + 360) % 360) / 90;
    const outW = turns % 2 === 0 ? sw : sh;
    const outH = turns % 2 === 0 ? sh : sw;
    const out = new Uint8ClampedArray(outW * outH * 4);
    const setPx = (x, y, si) => {
      const di = (y * outW + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    };
    if (turns === 0) {
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) setPx(x, y, (y * sw + x) * 4);
      }
    } else if (turns === 1) {
      // 90 CW: new(x, y) <- old(col=y, row=sh-1-x)
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) setPx(x, y, ((sh - 1 - x) * sw + y) * 4);
      }
    } else if (turns === 2) {
      // 180: new(x, y) <- old(sw-1-x, sh-1-y)
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) setPx(x, y, (((sh - 1 - y) * sw) + (sw - 1 - x)) * 4);
      }
    } else {
      // 270 CW (90 CCW): new(x, y) <- old(col=sw-1-y, row=x)
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) setPx(x, y, ((x * sw) + (sw - 1 - y)) * 4);
      }
    }
    return { width: outW, height: outH, data: out };
  }

  // Red-eye reduction: neutralize lifted blue channel in eyes (simple channel swap fix).
  static applyRedEye(imageData) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Eye region heuristic: strong red dominance with low green/blue relative to red
        if (r > 90 && r > (g + 25) && r > (b + 25)) {
          data[i] = g;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }
    }
    return imageData;
  }

  // Film grain: add deterministic pseudo-random noise scaled by amount.
  static applyGrain(imageData, amount = 0.02) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const a = Math.max(0, Math.min(1, amount));
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const noise = (n - Math.floor(n) - 0.5) * 2 * 255 * a;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    return imageData;
  }

  // Vignette: darken edges, keep center neutral.
  static applyVignette(imageData, strength = 0.3) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const s = Math.max(0, Math.min(1, strength));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = x - (w - 1) / 2;
        const dy = y - (h - 1) / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) / Math.max(w, h);
        const f = 1 - s * dist * dist;
        data[i] = Math.max(0, Math.min(255, data[i] * f));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * f));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * f));
      }
    }
    return imageData;
  }

  // Sharpen via unsharp-mask-like gain (amount 0 = neutral, >0 sharpens).
  static applySharpen(imageData, amount = 1) {
    const data = imageData.data;
    const gain = 1 + Math.max(0, amount);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * gain));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * gain));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * gain));
    }
    return imageData;
  }
}

module.exports = { MelLiteFilterEngine, FilterEngine };
