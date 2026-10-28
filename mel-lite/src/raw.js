// MelLite RAW Import Engine - reads uncompressed baseline DNG/TIFF image data.
// DNG layout: II/MM byte order, magic 42, IFD0 offset, IFD entries, strip pixel data.
// Supported subset: Compression=1 (none), BitsPerSample=16, SamplesPerPixel=3, single strip.
class MelRawImportEngine {
  static parseDng(bytes) {
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
    const photoEntry = getEntry(262);
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
    const stripOffsets = stripOffsetsEntry ? stripOffsetsEntry.value : 0;
    const stripByteCounts = stripByteCountsEntry ? stripByteCountsEntry.value : 0;

    if (compression !== 1) throw new Error('RAW compression not supported: ' + compression);
    if (bitsPerSample !== 16) throw new Error('RAW bit depth not supported: ' + bitsPerSample);
    const stripBytes = stripByteCounts;
    const stripStart = stripOffsets;
    if (stripStart + stripBytes > buf.length) throw new Error('RAW strip data out of bounds');

    const data = buf.subarray(stripStart, stripStart + stripBytes);
    return { width, height, bitsPerSample, compression, samplesPerPixel, stripByteCounts, data };
  }

  // Convert raw 16-bit strip data to 8-bit RGBA pixel array (scaled by 1/257).
  static toRGBA(raw) {
    const { width, height, data } = raw;
    const pixels = width * height;
    const out = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      const src = i * 6;
      const r = data[src] | (data[src + 1] << 8);
      const g = data[src + 2] | (data[src + 3] << 8);
      const b = data[src + 4] | (data[src + 5] << 8);
      out[i * 4] = Math.round((r * 255) / 65535);
      out[i * 4 + 1] = Math.round((g * 255) / 65535);
      out[i * 4 + 2] = Math.round((b * 255) / 65535);
      out[i * 4 + 3] = 255;
    }
    return { width, height, data: out };
  }
}

module.exports = { MelRawImportEngine };
