// MelDraw Subject Segmentation Engine
// Mask-based subject selection: flood fill from a point and color-range selection.

class SubjectSegmenter {
  // Flood select: BFS region grow from (startX, startY) within channel L1 tolerance.
  // Returns Uint8Array mask (1 = selected) of length width*height.
  static floodSelectMask(imageData, startX, startY, tolerance) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const mask = new Uint8Array(width * height);
    const startPos = startY * width + startX;
    mask[startPos] = 1;
    const queue = [startPos];
    const visited = new Uint8Array(width * height);
    visited[startPos] = 1;
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (queue.length > 0) {
      const pos = queue.shift();
      const cx = pos % width;
      const cy = Math.floor(pos / width);
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nPos = ny * width + nx;
        if (visited[nPos]) continue;
        const nIdx = nPos * 4;
        const dist = Math.abs(data[nIdx] - data[startPos * 4]) + Math.abs(data[nIdx + 1] - data[startPos * 4 + 1]) + Math.abs(data[nIdx + 2] - data[startPos * 4 + 2]);
        if (dist <= tolerance) {
          visited[nPos] = 1;
          mask[nPos] = 1;
          queue.push(nPos);
        }
      }
    }

    return { mask, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
  }

  // Color range select: mark pixels whose channel L1 distance from (r,g,b) <= tolerance.
  static colorSelectMask(imageData, r, g, b, tolerance) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const dist = Math.abs(data[idx] - r) + Math.abs(data[idx + 1] - g) + Math.abs(data[idx + 2] - b);
      if (dist <= tolerance) mask[i] = 1;
    }
    return { mask, bounds: SubjectSegmenter.maskBounds(mask, width, height) };
  }

  // Bounding box of set mask pixels (0,0,0,0 when nothing selected).
  static maskBounds(mask, width, height) {
    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }
}

module.exports = { SubjectSegmenter };
