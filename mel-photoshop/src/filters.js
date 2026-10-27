// MelPhoto Image Processing & Filter Engine

class FilterEngine {
  static applyBrightnessContrast(imageData, brightness = 0, contrast = 0) {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] + brightness - 128) + 128;
      data[i + 1] = factor * (data[i + 1] + brightness - 128) + 128;
      data[i + 2] = factor * (data[i + 2] + brightness - 128) + 128;
    }
    return imageData;
  }

  static applyInvert(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    return imageData;
  }

  static applyGrayscale(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
    return imageData;
  }

  static applySepia(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    }
    return imageData;
  }

  static applyThreshold(imageData, threshold = 128) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] >= threshold) ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    return imageData;
  }

  // Convolution matrix filter helper (Sharpen, Edge Detect, Emboss, Box Blur)
  static convolve(imageData, weights, opaque = true) {
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    const src = imageData.data;
    const sw = imageData.width;
    const sh = imageData.height;

    const output = new ImageData(sw, sh);
    const dst = output.data;

    const alphaFac = opaque ? 1 : 0;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0, a = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = Math.min(sh - 1, Math.max(0, y + cy - halfSide));
            const scx = Math.min(sw - 1, Math.max(0, x + cx - halfSide));
            const srcOff = (scy * sw + scx) * 4;
            const wt = weights[cy * side + cx];

            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
            a += src[srcOff + 3] * wt;
          }
        }
        dst[dstOff] = Math.min(255, Math.max(0, r));
        dst[dstOff + 1] = Math.min(255, Math.max(0, g));
        dst[dstOff + 2] = Math.min(255, Math.max(0, b));
        dst[dstOff + 3] = src[dstOff + 3];
      }
    }
    return output;
  }

  static applySharpen(imageData) {
    return FilterEngine.convolve(imageData, [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ]);
  }

  static applyFindEdges(imageData) {
    return FilterEngine.convolve(imageData, [
      -1, -1, -1,
      -1, 8, -1,
      -1, -1, -1
    ]);
  }

  static applyEmboss(imageData) {
    return FilterEngine.convolve(imageData, [
      -2, -1, 0,
      -1, 1, 1,
      0, 1, 2
    ]);
  }

  static applyBoxBlur(imageData) {
    const v = 1 / 9;
    return FilterEngine.convolve(imageData, [
      v, v, v,
      v, v, v,
      v, v, v
    ]);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterEngine;
}
