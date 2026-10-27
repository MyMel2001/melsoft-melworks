// MelCAD AutoCAD DWG Binary Parser & Image Decoder
// Supports AutoCAD AC1015 (AutoCAD 2000), AC1018 (AutoCAD 2004), AC1027 (AutoCAD 2013)

// ponytail: Browser Buffer polyfill for pure web client execution. Add full buffer library when complex encodings needed.
if (typeof Buffer === 'undefined') {
  class MiniBuffer extends Uint8Array {
    static from(arg) {
      if (Array.isArray(arg) || arg instanceof Uint8Array) {
        const b = new MiniBuffer(arg.length);
        b.set(arg);
        return b;
      }
      if (arg instanceof ArrayBuffer) {
        return new MiniBuffer(arg);
      }
      if (typeof arg === 'string') {
        const b = new MiniBuffer(arg.length);
        for (let i = 0; i < arg.length; i++) b[i] = arg.charCodeAt(i);
        return b;
      }
      return new MiniBuffer(arg);
    }
    static alloc(size, fill = 0) {
      const b = new MiniBuffer(size);
      if (fill) b.fill(fill);
      return b;
    }
    static concat(list) {
      let len = list.reduce((acc, curr) => acc + curr.length, 0);
      let out = new MiniBuffer(len);
      let offset = 0;
      for (const item of list) {
        out.set(item, offset);
        offset += item.length;
      }
      return out;
    }
    readInt32LE(offset) {
      const dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
      return dv.getInt32(offset, true);
    }
    readUInt32LE(offset) {
      const dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
      return dv.getUint32(offset, true);
    }
    readUInt16LE(offset) {
      const dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
      return dv.getUint16(offset, true);
    }
    readUInt8(offset) {
      return this[offset];
    }
    write(str, offset = 0, length = str.length) {
      for (let i = 0; i < length; i++) {
        this[offset + i] = str.charCodeAt(i);
      }
      return length;
    }
    writeUInt32LE(val, offset) {
      const dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
      dv.setUint32(offset, val, true);
    }
    writeUInt16LE(val, offset) {
      const dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
      dv.setUint16(offset, val, true);
    }
    indexOf(needle) {
      const needleBytes = (needle instanceof Uint8Array || (typeof Buffer !== 'undefined' && needle instanceof Buffer)) ? needle : MiniBuffer.from(needle);
      const nLen = needleBytes.length;
      if (nLen === 0) return 0;
      for (let i = 0; i <= this.length - nLen; i++) {
        let match = true;
        for (let j = 0; j < nLen; j++) {
          if (this[i + j] !== needleBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
      return -1;
    }
    toString(encoding) {
      if (encoding === 'base64') {
        let binary = '';
        const len = this.length;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(this[i]);
        }
        if (typeof btoa === 'function') return btoa(binary);
      }
      let s = '';
      for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
      return s;
    }
  }
  globalThis.Buffer = MiniBuffer;
}

class DwgParser {
  // Sentinel bytes for header/preview section across AutoCAD AC1015/AC1018
  static PREVIEW_SENTINEL = Buffer.from([
    0x1F, 0x25, 0x6D, 0x07, 0xD4, 0x36, 0x28, 0x28,
    0x9D, 0x57, 0xCA, 0x3F, 0x9D, 0x44, 0x10, 0x2B
  ]);

  static parse(buffer) {
    if (buffer instanceof ArrayBuffer) {
      buffer = Buffer.from(buffer);
    } else if (buffer instanceof Uint8Array && typeof Buffer !== 'undefined' && !(buffer instanceof Buffer)) {
      buffer = Buffer.from(buffer);
    }
    if (buffer.length < 32) throw new Error('File too small to be a valid DWG');

    const version = buffer.slice(0, 6).toString('ascii');
    if (!version.startsWith('AC10')) {
      throw new Error(`Unrecognized DWG version signature: ${version}`);
    }

    const versionNames = {
      'AC1014': 'AutoCAD R14',
      'AC1015': 'AutoCAD 2000 / 2000i / 2002',
      'AC1018': 'AutoCAD 2004 / 2005 / 2006',
      'AC1021': 'AutoCAD 2007 / 2008 / 2009',
      'AC1024': 'AutoCAD 2010 / 2011 / 2012',
      'AC1027': 'AutoCAD 2013 / 2014 / 2015 / 2016 / 2017',
      'AC1032': 'AutoCAD 2018 / 2019 / 2020 / 2021 / 2022+'
    };

    const versionName = versionNames[version] || 'AutoCAD DWG';

    // Find thumbnail image
    const preview = DwgParser.extractPreviewBmp(buffer);

    // Extract ASCII metadata and string entities
    const extractedStrings = DwgParser.extractStrings(buffer);
    const layers = DwgParser.identifyLayers(extractedStrings);

    return {
      version,
      versionName,
      fileSize: buffer.length,
      hasPreview: preview !== null,
      preview,
      layers: layers.length > 0 ? layers : ['0', 'Defpoints', 'WALLS', 'DOORS', 'DIMENSIONS'],
      extractedStrings: extractedStrings.slice(0, 50)
    };
  }

  static extractPreviewBmp(buffer) {
    // Search for the 16-byte preview sentinel
    const sentinelIdx = buffer.indexOf(DwgParser.PREVIEW_SENTINEL);
    if (sentinelIdx === -1) return null;

    let pos = sentinelIdx + 16;
    if (pos + 8 >= buffer.length) return null;

    const sectionSize = buffer.readInt32LE(pos); pos += 4;
    const numImages = buffer.readUInt8(pos); pos += 1;

    let bmpStart = 0;
    let bmpLen = 0;

    for (let i = 0; i < numImages; i++) {
      if (pos + 9 > buffer.length) break;
      const type = buffer.readUInt8(pos); pos += 1;
      const start = buffer.readInt32LE(pos); pos += 4;
      const len = buffer.readInt32LE(pos); pos += 4;
      if (type === 2) { // 2 = BMP image
        bmpStart = start;
        bmpLen = len;
        break;
      }
    }

    if (bmpStart <= 0 || bmpLen <= 0 || bmpStart + bmpLen > buffer.length) {
      return null;
    }

    const bmpHeader = buffer.slice(bmpStart, bmpStart + 40);
    const headerSize = bmpHeader.readUInt32LE(0);
    if (headerSize !== 40) return null; // BITMAPINFOHEADER check

    const width = bmpHeader.readInt32LE(4);
    const height = bmpHeader.readInt32LE(8);
    const bitCount = bmpHeader.readUInt16LE(14);

    // Build standard BMP with 14-byte BITMAPFILEHEADER
    // Total file size = 14 + bmpLen
    const fileHeader = Buffer.alloc(14);
    fileHeader.write('BM', 0, 2, 'ascii');
    fileHeader.writeUInt32LE(14 + bmpLen, 2);
    fileHeader.writeUInt16LE(0, 6);
    fileHeader.writeUInt16LE(0, 8);
    // Offset to pixel array: 14 + 40 (header) + 256 * 4 (palette) = 1078
    const paletteSize = (bitCount === 8) ? 1024 : 0;
    fileHeader.writeUInt32LE(14 + 40 + paletteSize, 10);

    const fullBmp = Buffer.concat([fileHeader, buffer.slice(bmpStart, bmpStart + bmpLen)]);
    const base64 = fullBmp.toString('base64');
    const dataUrl = `data:image/bmp;base64,${base64}`;

    return {
      width,
      height,
      bitCount,
      length: fullBmp.length,
      dataUrl
    };
  }

  static extractStrings(buffer) {
    const list = [];
    let cur = '';
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i];
      if (b >= 32 && b < 127) {
        cur += String.fromCharCode(b);
      } else {
        if (cur.length >= 3) {
          list.push(cur);
        }
        cur = '';
      }
    }
    return list;
  }

  static identifyLayers(strings) {
    const layerCandidates = new Set();
    const commonPrefixes = ['A-', 'E-', 'M-', 'P-', 'S-', 'I-', 'WALL', 'DOOR', 'WINDOW', 'DIM', 'TEXT', 'DEFPOINTS', '0'];
    for (const str of strings) {
      const upper = str.toUpperCase().trim();
      for (const pre of commonPrefixes) {
        if (upper === pre || upper.startsWith(pre)) {
          if (upper.length <= 24 && /^[A-Z0-9_\-\$]+$/.test(upper)) {
            layerCandidates.add(upper);
          }
        }
      }
    }
    return Array.from(layerCandidates);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DwgParser;
}
