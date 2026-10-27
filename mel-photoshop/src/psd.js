// MelPhoto PSD Binary Encoder & Decoder
// Strictly implements Adobe Photoshop File Formats Specification (November 2019)

class PackBits {
  // Decompress Adobe Photoshop PackBits RLE
  static decompress(srcBuf, expectedLength) {
    const dest = Buffer.alloc(expectedLength);
    let srcPos = 0;
    let destPos = 0;

    while (srcPos < srcBuf.length && destPos < expectedLength) {
      const n = srcBuf.readInt8(srcPos++);
      if (n >= 0 && n <= 127) {
        const count = n + 1;
        for (let i = 0; i < count && srcPos < srcBuf.length && destPos < expectedLength; i++) {
          dest[destPos++] = srcBuf[srcPos++];
        }
      } else if (n >= -127 && n <= -1) {
        const count = 1 - n;
        const val = srcBuf[srcPos++];
        for (let i = 0; i < count && destPos < expectedLength; i++) {
          dest[destPos++] = val;
        }
      } else if (n === -128) {
        // No-op
      }
    }
    return dest;
  }

  // Compress into Adobe Photoshop PackBits RLE
  static compress(srcBuf) {
    const chunks = [];
    let i = 0;
    const len = srcBuf.length;

    while (i < len) {
      // Check for runs of repeated bytes
      let runLen = 1;
      while (i + runLen < len && srcBuf[i + runLen] === srcBuf[i] && runLen < 128) {
        runLen++;
      }

      if (runLen >= 3) {
        // Repeated run
        const header = (1 - runLen) & 0xFF;
        chunks.push(Buffer.from([header, srcBuf[i]]));
        i += runLen;
      } else {
        // Literal run
        let litLen = 0;
        while (i + litLen < len && litLen < 128) {
          if (i + litLen + 2 < len &&
              srcBuf[i + litLen] === srcBuf[i + litLen + 1] &&
              srcBuf[i + litLen] === srcBuf[i + litLen + 2]) {
            break; // Stop literal run if repeated run of 3 starts
          }
          litLen++;
        }
        if (litLen > 0) {
          const header = (litLen - 1) & 0xFF;
          const litBuf = Buffer.alloc(1 + litLen);
          litBuf[0] = header;
          srcBuf.copy(litBuf, 1, i, i + litLen);
          chunks.push(litBuf);
          i += litLen;
        }
      }
    }
    return Buffer.concat(chunks);
  }
}

class PsdDocument {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.channels = options.channels || 4; // RGBA
    this.depth = options.depth || 8;
    this.colorMode = options.colorMode || 3; // RGB = 3
    this.layers = options.layers || [
      {
        name: 'Background',
        top: 0,
        left: 0,
        bottom: options.height || 600,
        right: options.width || 800,
        opacity: 255,
        blendMode: 'norm',
        visible: true,
        // RGBA Buffer of width * height * 4
        rgbaData: options.rgbaData || Buffer.alloc((options.width || 800) * (options.height || 600) * 4, 255)
      }
    ];
  }

  // Map blend mode names to 4-byte 8BIM keys
  static blendModeToKey(mode) {
    const map = {
      'normal': 'norm',
      'norm': 'norm',
      'multiply': 'mul ',
      'screen': 'scrn',
      'overlay': 'over',
      'darken': 'dark',
      'lighten': 'lite',
      'color-dodge': 'lddg',
      'difference': 'diff'
    };
    return map[mode] || 'norm';
  }

  static keyToBlendMode(key) {
    const map = {
      'norm': 'normal',
      'mul ': 'multiply',
      'scrn': 'screen',
      'over': 'overlay',
      'dark': 'darken',
      'lite': 'lighten',
      'lddg': 'color-dodge',
      'diff': 'difference'
    };
    return map[key] || 'normal';
  }

  toBuffer() {
    const w = this.width;
    const h = this.height;

    // 1. File Header (26 bytes)
    const header = Buffer.alloc(26);
    header.write('8BPS', 0, 4, 'ascii');
    header.writeUInt16BE(1, 4); // Version 1
    // bytes 6..11 are 0 (reserved)
    header.writeUInt16BE(3, 12); // 3 channels for composite (RGB)
    header.writeUInt32BE(h, 14);
    header.writeUInt32BE(w, 18);
    header.writeUInt16BE(8, 22); // 8 bits per channel
    header.writeUInt16BE(3, 24); // ColorMode 3 = RGB

    // 2. Color Mode Data Section (4 bytes: length = 0)
    const colorModeData = Buffer.alloc(4);
    colorModeData.writeUInt32BE(0, 0);

    // 3. Image Resources Section (8BIM resolution block)
    const resChunk = Buffer.alloc(28);
    let resPos = 0;
    resChunk.write('8BIM', resPos, 4, 'ascii'); resPos += 4;
    resChunk.writeUInt16BE(0x03ED, resPos); resPos += 2; // ResolutionInfo ID
    resChunk.writeUInt16BE(0, resPos); resPos += 2; // Empty Pascal string (padded)
    resChunk.writeUInt32BE(16, resPos); resPos += 4; // Data size = 16
    resChunk.writeUInt32BE(72 << 16, resPos); resPos += 4; // 72 DPI hRes
    resChunk.writeUInt16BE(1, resPos); resPos += 2; // units = pixels/inch
    resChunk.writeUInt16BE(1, resPos); resPos += 2;
    resChunk.writeUInt32BE(72 << 16, resPos); resPos += 4; // 72 DPI vRes
    resChunk.writeUInt16BE(1, resPos); resPos += 2;
    resChunk.writeUInt16BE(1, resPos); resPos += 2;

    const imgResSec = Buffer.alloc(4 + resChunk.length);
    imgResSec.writeUInt32BE(resChunk.length, 0);
    resChunk.copy(imgResSec, 4);

    // 4. Layer and Mask Information Section
    const layerCount = this.layers.length;
    const layerRecords = [];
    const channelDataBuffers = [];

    for (let lIdx = 0; lIdx < layerCount; lIdx++) {
      const layer = this.layers[lIdx];
      const lw = Math.max(1, layer.right - layer.left);
      const lh = Math.max(1, layer.bottom - layer.top);
      const pixelCount = lw * lh;

      // Extract channels: Red, Green, Blue, Alpha
      const rChan = Buffer.alloc(pixelCount);
      const gChan = Buffer.alloc(pixelCount);
      const bChan = Buffer.alloc(pixelCount);
      const aChan = Buffer.alloc(pixelCount);

      const rgba = layer.rgbaData;
      for (let p = 0; p < pixelCount; p++) {
        const off = p * 4;
        rChan[p] = rgba ? rgba[off] : 255;
        gChan[p] = rgba ? rgba[off + 1] : 255;
        bChan[p] = rgba ? rgba[off + 2] : 255;
        aChan[p] = rgba ? rgba[off + 3] : 255;
      }

      // PackBits RLE compress each channel
      const rComp = PackBits.compress(rChan);
      const gComp = PackBits.compress(gChan);
      const bComp = PackBits.compress(bChan);
      const aComp = PackBits.compress(aChan);

      // Channel data includes 2 bytes compression (1 = RLE)
      const rData = Buffer.concat([Buffer.from([0, 1]), rComp]);
      const gData = Buffer.concat([Buffer.from([0, 1]), gComp]);
      const bData = Buffer.concat([Buffer.from([0, 1]), bComp]);
      const aData = Buffer.concat([Buffer.from([0, 1]), aComp]);

      channelDataBuffers.push(rData, gData, bData, aData);

      // Layer record structure
      const name = layer.name || `Layer ${lIdx + 1}`;
      const nameLen = Math.min(name.length, 255);
      const namePaddedLen = Math.ceil((nameLen + 1) / 4) * 4; // Multiple of 4
      const extraDataLen = 4 + 4 + namePaddedLen;

      const recordLen = 16 + 2 + (4 * 6) + 4 + 4 + 4 + 4 + extraDataLen;
      const rec = Buffer.alloc(recordLen);
      let p = 0;

      rec.writeInt32BE(layer.top, p); p += 4;
      rec.writeInt32BE(layer.left, p); p += 4;
      rec.writeInt32BE(layer.bottom, p); p += 4;
      rec.writeInt32BE(layer.right, p); p += 4;
      rec.writeUInt16BE(4, p); p += 2; // 4 channels

      // Channel 0 (Red)
      rec.writeInt16BE(0, p); p += 2;
      rec.writeUInt32BE(rData.length, p); p += 4;
      // Channel 1 (Green)
      rec.writeInt16BE(1, p); p += 2;
      rec.writeUInt32BE(gData.length, p); p += 4;
      // Channel 2 (Blue)
      rec.writeInt16BE(2, p); p += 2;
      rec.writeUInt32BE(bData.length, p); p += 4;
      // Channel -1 (Transparency)
      rec.writeInt16BE(-1, p); p += 2;
      rec.writeUInt32BE(aData.length, p); p += 4;

      rec.write('8BIM', p, 4, 'ascii'); p += 4;
      const blendKey = PsdDocument.blendModeToKey(layer.blendMode);
      rec.write(blendKey, p, 4, 'ascii'); p += 4;

      rec.writeUInt8(layer.opacity !== undefined ? layer.opacity : 255, p++);
      rec.writeUInt8(0, p++); // Clipping = 0
      rec.writeUInt8(layer.visible ? 0 : 2, p++); // Flags (bit 1 = invisible)
      rec.writeUInt8(0, p++); // Filler

      rec.writeUInt32BE(extraDataLen, p); p += 4;
      rec.writeUInt32BE(0, p); p += 4; // Mask size = 0
      rec.writeUInt32BE(0, p); p += 4; // Blending ranges size = 0

      // Pascal string name
      rec.writeUInt8(nameLen, p++);
      rec.write(name, p, nameLen, 'ascii');
      // remaining padded bytes are 0

      layerRecords.push(rec);
    }

    const layerRecordsBuf = Buffer.concat(layerRecords);
    const channelDataBuf = Buffer.concat(channelDataBuffers);

    const layerInfoLen = 2 + layerRecordsBuf.length + channelDataBuf.length;
    const layerInfoBuf = Buffer.alloc(4 + layerInfoLen);
    layerInfoBuf.writeUInt32BE(layerInfoLen, 0);
    layerInfoBuf.writeInt16BE(layerCount, 4);
    layerRecordsBuf.copy(layerInfoBuf, 6);
    channelDataBuf.copy(layerInfoBuf, 6 + layerRecordsBuf.length);

    const layerSecBuf = Buffer.alloc(4 + layerInfoBuf.length);
    layerSecBuf.writeUInt32BE(layerInfoBuf.length, 0);
    layerInfoBuf.copy(layerSecBuf, 4);

    // 5. Image Data Section (Composite RGB flat image)
    const compositePixels = w * h;
    const compR = Buffer.alloc(compositePixels);
    const compG = Buffer.alloc(compositePixels);
    const compB = Buffer.alloc(compositePixels);

    // Composite layers bottom-up
    for (let i = 0; i < compositePixels; i++) {
      let r = 255, g = 255, b = 255;
      for (const layer of this.layers) {
        if (!layer.visible) continue;
        const rgba = layer.rgbaData;
        if (rgba && rgba.length >= compositePixels * 4) {
          const lr = rgba[i * 4];
          const lg = rgba[i * 4 + 1];
          const lb = rgba[i * 4 + 2];
          const la = (rgba[i * 4 + 3] / 255) * ((layer.opacity !== undefined ? layer.opacity : 255) / 255);
          r = Math.round(r * (1 - la) + lr * la);
          g = Math.round(g * (1 - la) + lg * la);
          b = Math.round(b * (1 - la) + lb * la);
        }
      }
      compR[i] = r;
      compG[i] = g;
      compB[i] = b;
    }

    // Compression: 0 = Raw
    const imgDataSec = Buffer.alloc(2 + compositePixels * 3);
    imgDataSec.writeUInt16BE(0, 0); // Raw compression
    compR.copy(imgDataSec, 2);
    compG.copy(imgDataSec, 2 + compositePixels);
    compB.copy(imgDataSec, 2 + compositePixels * 2);

    return Buffer.concat([header, colorModeData, imgResSec, layerSecBuf, imgDataSec]);
  }

  // Parse PSD binary buffer
  static parse(buffer) {
    if (buffer.length < 26) throw new Error('File too small for PSD header');

    const sig = buffer.slice(0, 4).toString('ascii');
    if (sig !== '8BPS') throw new Error(`Invalid PSD signature: ${sig}`);

    const version = buffer.readUInt16BE(4);
    const channels = buffer.readUInt16BE(12);
    const height = buffer.readUInt32BE(14);
    const width = buffer.readUInt32BE(18);
    const depth = buffer.readUInt16BE(22);
    const colorMode = buffer.readUInt16BE(24);

    let pos = 26;

    // Color Mode Data
    const colorModeLen = buffer.readUInt32BE(pos); pos += 4;
    pos += colorModeLen;

    // Image Resources
    const imgResLen = buffer.readUInt32BE(pos); pos += 4;
    pos += imgResLen;

    // Layer and Mask Info
    const layerSecLen = buffer.readUInt32BE(pos); pos += 4;
    const endLayerSec = pos + layerSecLen;

    const layers = [];
    if (layerSecLen > 0 && pos < buffer.length) {
      const layerInfoLen = buffer.readUInt32BE(pos); pos += 4;
      if (layerInfoLen > 0) {
        const rawLayerCount = buffer.readInt16BE(pos); pos += 2;
        const layerCount = Math.abs(rawLayerCount);

        const recs = [];
        for (let l = 0; l < layerCount; l++) {
          const top = buffer.readInt32BE(pos); pos += 4;
          const left = buffer.readInt32BE(pos); pos += 4;
          const bottom = buffer.readInt32BE(pos); pos += 4;
          const right = buffer.readInt32BE(pos); pos += 4;
          const numChannels = buffer.readUInt16BE(pos); pos += 2;

          const chInfo = [];
          for (let c = 0; c < numChannels; c++) {
            const chId = buffer.readInt16BE(pos); pos += 2;
            const chLen = buffer.readUInt32BE(pos); pos += 4;
            chInfo.push({ id: chId, length: chLen });
          }

          const bim = buffer.slice(pos, pos + 4).toString('ascii'); pos += 4;
          const blendKey = buffer.slice(pos, pos + 4).toString('ascii'); pos += 4;
          const opacity = buffer.readUInt8(pos++);
          const clipping = buffer.readUInt8(pos++);
          const flags = buffer.readUInt8(pos++);
          const filler = buffer.readUInt8(pos++);

          const extraLen = buffer.readUInt32BE(pos); pos += 4;
          const endExtra = pos + extraLen;

          const maskLen = buffer.readUInt32BE(pos); pos += 4; pos += maskLen;
          const rangesLen = buffer.readUInt32BE(pos); pos += 4; pos += rangesLen;

          const nameLen = buffer.readUInt8(pos++);
          const name = buffer.slice(pos, pos + nameLen).toString('ascii');
          pos = endExtra;

          recs.push({
            top, left, bottom, right, numChannels, chInfo,
            blendMode: PsdDocument.keyToBlendMode(blendKey),
            opacity, visible: (flags & 2) === 0, name
          });
        }

        // Read channel data for each layer
        for (const rec of recs) {
          const lw = Math.max(1, rec.right - rec.left);
          const lh = Math.max(1, rec.bottom - rec.top);
          const pixelCount = lw * lh;
          const rgba = Buffer.alloc(pixelCount * 4, 255);

          for (const ch of rec.chInfo) {
            const comp = buffer.readUInt16BE(pos); pos += 2;
            const dataLen = ch.length - 2;
            const compData = buffer.slice(pos, pos + dataLen); pos += dataLen;

            let decomp;
            if (comp === 1) {
              decomp = PackBits.decompress(compData, pixelCount);
            } else {
              decomp = compData.slice(0, pixelCount);
            }

            // Map channel to RGBA: 0=R, 1=G, 2=B, -1=A
            const offset = (ch.id === 0) ? 0 : (ch.id === 1) ? 1 : (ch.id === 2) ? 2 : 3;
            for (let pIdx = 0; pIdx < pixelCount && pIdx < decomp.length; pIdx++) {
              rgba[pIdx * 4 + offset] = decomp[pIdx];
            }
          }

          layers.push({
            name: rec.name,
            top: rec.top,
            left: rec.left,
            bottom: rec.bottom,
            right: rec.right,
            opacity: rec.opacity,
            blendMode: rec.blendMode,
            visible: rec.visible,
            rgbaData: rgba
          });
        }
      }
    }

    pos = endLayerSec;

    return new PsdDocument({
      width,
      height,
      channels,
      depth,
      colorMode,
      layers: layers.length ? layers : [
        {
          name: 'Background',
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          opacity: 255,
          blendMode: 'normal',
          visible: true,
          rgbaData: Buffer.alloc(width * height * 4, 255)
        }
      ]
    });
  }
}

module.exports = { PsdDocument, PackBits };
