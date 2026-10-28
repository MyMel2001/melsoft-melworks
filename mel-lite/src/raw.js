// MelLite RAW Import Engine - reads uncompressed baseline DNG/TIFF image data.
// TIFF-family layout: byte order, magic 42, IFD0 offset, IFD entries, strip pixel data.
// Supported subset: Compression=1 (none), BitsPerSample 8 or 16, SamplesPerPixel=3.
class MelRawImportEngine {
  static parseTiff(bytes) {
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (buf.length < 8) throw new Error('RAW file too short');
    const little = buf[0] === 0x49 && buf[1] === 0x49; // "II"
    const big = buf[0] === 0x4d && buf[1] === 0x4d; // "MM"
    if (!little && !big) throw new Error('RAW file is not a TIFF-family format');
    const readU16 = (off) => little ? buf[off] | (buf[off + 1] << 8) : (buf[off] << 8) | buf[off + 1];
    const readU32 = (off) => little ? buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24) : ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]);
    if (readU16(2) !== 42) throw new Error('RAW file has invalid TIFF magic');

    const ifdOffset = readU32(4);
    const entryCount = readU16(ifdOffset);
    const entries = [];
    let off = ifdOffset + 2;
    for (let i = 0; i < entryCount; i++) {
      const tag = readU16(off);
      const type = readU16(off + 2);
      const count = readU32(off + 4);
      const value = readU32(off + 8);
      entries.push({ tag, type, count, value });
      off += 12;
    }

    const getEntry = (tag) => entries.find((e) => e.tag === tag) || null;
    const widthEntry = getEntry(256);
    const heightEntry = getEntry(257);
    const bitsEntry = getEntry(258);
    const compressionEntry = getEntry(259);
    const samplesEntry = getEntry(277);
    const rowsEntry = getEntry(278);
    const stripOffsetsEntry = getEntry(273);
    const stripByteCountsEntry = getEntry(279);

    if (!widthEntry || !heightEntry) throw new Error('RAW file missing dimensions');
    const width = widthEntry.value;
    const height = heightEntry.value;
    const bitsPerSample = bitsEntry ? bitsEntry.value : 16;
    const compression = compressionEntry ? compressionEntry.value : 1;
    const samplesPerPixel = samplesEntry ? samplesEntry.value : 3;
    const rowsPerStrip = rowsEntry ? rowsEntry.value : height;

    if (compression !== 1) throw new Error('RAW compression not supported: ' + compression);
    if (bitsPerSample !== 8 && bitsPerSample !== 16) throw new Error('RAW bit depth not supported: ' + bitsPerSample);

    const offsets = stripOffsetsEntry && stripOffsetsEntry.count > 1
      ? MelRawImportEngine.readI32Array(buf, stripOffsetsEntry.value, stripOffsetsEntry.count, little)
      : [stripOffsetsEntry ? stripOffsetsEntry.value : 0];
    const counts = stripByteCountsEntry && stripByteCountsEntry.count > 1
      ? MelRawImportEngine.readI32Array(buf, stripByteCountsEntry.value, stripByteCountsEntry.count, little)
      : [stripByteCountsEntry ? stripByteCountsEntry.value : 0];
    const totalBytes = counts.reduce((n, c) => n + c, 0);
    const data = new Uint8Array(totalBytes);
    let acc = 0;
    for (let s = 0; s < counts.length; s++) {
      data.set(buf.subarray(offsets[s], offsets[s] + counts[s]), acc);
      acc += counts[s];
    }

    return { width, height, bitsPerSample, compression, samplesPerPixel, rowsPerStrip, data };
  }

  static readI32Array(buf, offset, count, little) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const o = offset + i * 4;
      out.push(little ? (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) : ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]));
    }
    return out;
  }

  static parseDng(bytes) {
    const parsed = MelRawImportEngine.parseTiff(bytes);
    if (!parsed || !parsed.width) throw new Error('RAW file missing dimensions');
    return parsed;
  }

  // Convert raw strip data (8 or 16 bit) to 8-bit RGBA pixel array.
  static toRGBA(raw) {
    const { width, height, data, samplesPerPixel, bitsPerSample } = raw;
    const spp = samplesPerPixel || 3;
    const pixels = width * height;
    const out = new Uint8ClampedArray(pixels * 4);
    const is16 = (bitsPerSample || 16) === 16;
    const bytesPerSample = is16 ? 2 : 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = ((y * width + x) * spp) * bytesPerSample;
        const r = is16 ? (data[si] | (data[si + 1] << 8)) : data[si];
        const g = is16 ? (data[si + 2] | (data[si + 3] << 8)) : data[si + 1];
        const b = is16 ? (data[si + 4] | (data[si + 5] << 8)) : data[si + 2];
        const o = (y * width + x) * 4;
        out[o] = is16 ? Math.round((r * 255) / 65535) : Math.min(255, r);
        out[o + 1] = is16 ? Math.round((g * 255) / 65535) : Math.min(255, g);
        out[o + 2] = is16 ? Math.round((b * 255) / 65535) : Math.min(255, b);
        out[o + 3] = 255;
      }
    }
    return { width, height, data: out };
  }
}

module.exports = { MelRawImportEngine };
