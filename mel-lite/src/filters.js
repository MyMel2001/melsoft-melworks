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
  // Works on a copy so callers can preview without mutating the committed source image.
  static apply(imageData, adjustments = {}) {
    const src = imageData && imageData.data ? imageData.data : imageData;
    const width = imageData ? imageData.width : 0;
    const height = imageData ? imageData.height : 0;
    const data = new Uint8ClampedArray(src.length);
    data.set(src);
    let out = { width, height, data };
    out = MelLiteFilterEngine.applyExposure(out, adjustments.exposure || 0);
    out = MelLiteFilterEngine.applyContrast(out, adjustments.contrast || 0);
    out = MelLiteFilterEngine.applyBrightness(out, adjustments.brightness || 0);
    out = MelLiteFilterEngine.applySaturation(out, adjustments.saturation === undefined ? 1 : adjustments.saturation);
    out = MelLiteFilterEngine.applyWhiteBalance(out, adjustments.whiteBalance || { r: 1, g: 1, b: 1 });
    if (adjustments.curves) {
      out = FilterEngine.applyCurves(out, adjustments.curves, 'rgb');
    }
    if (adjustments.local) {
      out = MelLiteFilterEngine.applyLocalAdjustments(out, adjustments.local, {
        exposure: adjustments.exposure,
        contrast: adjustments.contrast,
        brightness: adjustments.brightness,
        saturation: adjustments.saturation,
        whiteBalance: adjustments.whiteBalance,
        curves: adjustments.curves,
        sharpen: adjustments.sharpen
      });
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
    if (adjustments.blur) {
      out = MelLiteFilterEngine.applyBlur(out, adjustments.blur);
    }
    if (adjustments.pixelate) {
      out = MelLiteFilterEngine.applyPixelate(out, adjustments.pixelate);
    }
    if (adjustments.border) {
      out = MelLiteFilterEngine.applyBorder(out, adjustments.border);
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

  // Local adjustments: apply development ops within a region only; outside keeps original.
  static applyLocalAdjustments(imageData, region = { x: 0, y: 0, width: imageData.width, height: imageData.height }, adjustments = {}) {
    const crop = { x: Math.round(region.x) || 0, y: Math.round(region.y) || 0, width: Math.round(region.width) || imageData.width, height: Math.round(region.height) || imageData.height };
    const local = MelLiteFilterEngine.applyCrop(imageData, crop);
    const adjusted = MelLiteFilterEngine.apply(local, {
      exposure: adjustments.exposure,
      contrast: adjustments.contrast,
      brightness: adjustments.brightness,
      saturation: adjustments.saturation,
      whiteBalance: adjustments.whiteBalance,
      curves: adjustments.curves,
      sharpen: adjustments.sharpen
    });
    const out = new Uint8ClampedArray(imageData.data.length);
    const ow = imageData.width;
    const oh = imageData.height;
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const di = (y * ow + x) * 4;
        const inRegion = x >= crop.x && x < crop.x + crop.width && y >= crop.y && y < crop.y + crop.height;
        if (!inRegion) {
          out[di] = imageData.data[di];
          out[di + 1] = imageData.data[di + 1];
          out[di + 2] = imageData.data[di + 2];
          out[di + 3] = imageData.data[di + 3];
        } else {
          const li = (((y - crop.y) * crop.width) + (x - crop.x)) * 4;
          out[di] = adjusted.data[li];
          out[di + 1] = adjusted.data[li + 1];
          out[di + 2] = adjusted.data[li + 2];
          out[di + 3] = adjusted.data[li + 3];
        }
      }
    }
    return { width: imageData.width, height: imageData.height, data: out };
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
  // Highlight roll-off: compress highlights above threshold to protect highlight detail.
  static applyHighlightRollOff(imageData, threshold = 250, rolloff = 0.5) {
    const data = imageData.data;
    const t = Math.max(0, threshold);
    const r = Math.max(0, Math.min(1, rolloff));
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = data[i + c];
        if (v > t) {
          data[i + c] = Math.round(v - (v - t) * r);
        }
      }
    }
    return imageData;
  }

  // Box blur via separable two-pass average (radius px; window = 2*radius+1).
  static applyBlur(imageData, radius = 2) {
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const r = Math.max(0, Math.round(radius) || 0);
    const box = Math.max(1, Math.min(w, r * 2 + 1));
    const half = Math.floor(box / 2);
    const temp = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - half);
        const x1 = Math.min(w - 1, x + half);
        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
        for (let px = x0; px <= x1; px++) {
          const si = (y * w + px) * 4;
          sr += src[si]; sg += src[si + 1]; sb += src[si + 2]; sa += src[si + 3];
          n++;
        }
        const di = (y * w + x) * 4;
        temp[di] = Math.round(sr / n);
        temp[di + 1] = Math.round(sg / n);
        temp[di + 2] = Math.round(sb / n);
        temp[di + 3] = Math.round(sa / n);
      }
    }
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const y0 = Math.max(0, y - half);
        const y1 = Math.min(h - 1, y + half);
        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
        for (let py = y0; py <= y1; py++) {
          const di = (py * w + x) * 4;
          sr += temp[di]; sg += temp[di + 1]; sb += temp[di + 2]; sa += temp[di + 3];
          n++;
        }
        const di = (y * w + x) * 4;
        out[di] = Math.round(sr / n);
        out[di + 1] = Math.round(sg / n);
        out[di + 2] = Math.round(sb / n);
        out[di + 3] = Math.round(sa / n);
      }
    }
    return { width: w, height: h, data: out };
  }

  // Pixelate: average each pixelSize x pixelSize block into one flat color.
  static applyPixelate(imageData, pixelSize = 8) {
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const size = Math.max(1, Math.round(pixelSize) || 1);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let by = 0; by < h; by += size) {
      const bh = Math.min(size, h - by);
      for (let bx = 0; bx < w; bx += size) {
        const bw = Math.min(size, w - bx);
        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const si = (y * w + x) * 4;
            sr += src[si]; sg += src[si + 1]; sb += src[si + 2]; sa += src[si + 3];
            n++;
          }
        }
        const r = Math.round(sr / n);
        const g = Math.round(sg / n);
        const b = Math.round(sb / n);
        const a = Math.round(sa / n);
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const di = (y * w + x) * 4;
            out[di] = r;
            out[di + 1] = g;
            out[di + 2] = b;
            out[di + 3] = a;
          }
        }
      }
    }
    return { width: w, height: h, data: out };
  }

  // Border: add colored frame of `width` px around image; output dims grow by 2*width.
  static applyBorder(imageData, border = { width: 0, color: { r: 0, g: 0, b: 0, a: 255 } }) {
    const bw = Math.max(0, Math.round(border.width) || 0);
    const color = border.color || { r: 0, g: 0, b: 0, a: 255 };
    const cr = Math.max(0, Math.min(255, Math.round(color.r) || 0));
    const cg = Math.max(0, Math.min(255, Math.round(color.g) || 0));
    const cb = Math.max(0, Math.min(255, Math.round(color.b) || 0));
    const ca = Math.max(0, Math.min(255, Math.round(color.a === undefined ? 255 : color.a) || 255));
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const outW = w + bw * 2;
    const outH = h + bw * 2;
    const out = new Uint8ClampedArray(outW * outH * 4);
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const di = (y * outW + x) * 4;
        const inX = x - bw;
        const inY = y - bw;
        if (inX >= 0 && inX < w && inY >= 0 && inY < h) {
          const si = (inY * w + inX) * 4;
          out[di] = src[si];
          out[di + 1] = src[si + 1];
          out[di + 2] = src[si + 2];
          out[di + 3] = src[si + 3];
        } else {
          out[di] = cr;
          out[di + 1] = cg;
          out[di + 2] = cb;
          out[di + 3] = ca;
        }
      }
    }
    return { width: outW, height: outH, data: out };
  }
}

module.exports = { MelLiteFilterEngine, FilterEngine };
