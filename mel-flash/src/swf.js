// MelFlash SWF Binary Encoder & Decoder (Adobe SWF Specification v19 Compliant with AS3 / AVM2)

const As3Engine = (typeof require !== 'undefined') ? require('./as3') : (typeof window !== 'undefined' ? window.As3Engine : null);

class BitWriter {
  constructor() {
    this.buffer = Buffer.alloc(4096);
    this.bitPos = 0; // current bit index
    this.byteLength = 0;
  }

  ensureCapacity(extraBytes) {
    if (this.byteLength + extraBytes >= this.buffer.length) {
      const newBuf = Buffer.alloc(Math.max(this.buffer.length * 2, this.buffer.length + extraBytes + 1024));
      this.buffer.copy(newBuf);
      this.buffer = newBuf;
    }
  }

  writeBits(value, numBits) {
    for (let i = numBits - 1; i >= 0; i--) {
      const bit = (value >> i) & 1;
      const byteIdx = Math.floor(this.bitPos / 8);
      const bitOffset = 7 - (this.bitPos % 8);
      this.ensureCapacity(2);
      if (bit) {
        this.buffer[byteIdx] |= (1 << bitOffset);
      } else {
        this.buffer[byteIdx] &= ~(1 << bitOffset);
      }
      this.bitPos++;
      this.byteLength = Math.max(this.byteLength, Math.floor((this.bitPos + 7) / 8));
    }
  }

  writeSignedBits(value, numBits) {
    if (value < 0) {
      value = (1 << numBits) + value;
    }
    this.writeBits(value, numBits);
  }

  flushByte() {
    if (this.bitPos % 8 !== 0) {
      this.bitPos = Math.ceil(this.bitPos / 8) * 8;
      this.byteLength = this.bitPos / 8;
    }
  }

  writeUI8(val) {
    this.flushByte();
    this.ensureCapacity(1);
    this.buffer.writeUInt8(val & 0xFF, this.byteLength);
    this.byteLength += 1;
    this.bitPos = this.byteLength * 8;
  }

  writeUI16(val) {
    this.flushByte();
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(val & 0xFFFF, this.byteLength);
    this.byteLength += 2;
    this.bitPos = this.byteLength * 8;
  }

  writeUI32(val) {
    this.flushByte();
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(val >>> 0, this.byteLength);
    this.byteLength += 4;
    this.bitPos = this.byteLength * 8;
  }

  writeBytes(buf) {
    this.flushByte();
    this.ensureCapacity(buf.length);
    if (Buffer.isBuffer(buf)) {
      buf.copy(this.buffer, this.byteLength);
    } else {
      for (let i = 0; i < buf.length; i++) {
        this.buffer[this.byteLength + i] = buf[i];
      }
    }
    this.byteLength += buf.length;
    this.bitPos = this.byteLength * 8;
  }

  toBuffer() {
    this.flushByte();
    return this.buffer.slice(0, this.byteLength);
  }
}

class SwfMovie {
  constructor(options = {}) {
    this.version = options.version || 19;
    this.width = options.width || 800; // in pixels
    this.height = options.height || 600; // in pixels
    this.fps = options.fps || 24;
    this.backgroundColor = options.backgroundColor || { r: 255, g: 255, b: 255 };
    this.frames = options.frames || []; // Array of frame objects { elements: [], actions: [] }
    this.as3 = (options.as3 !== undefined) ? options.as3 : true;
    this.documentClass = options.documentClass || 'Main';
  }

  static encodeRect(xMinPx, xMaxPx, yMinPx, yMaxPx) {
    // Twips = 20 * pixels
    const xMin = Math.round(xMinPx * 20);
    const xMax = Math.round(xMaxPx * 20);
    const yMin = Math.round(yMinPx * 20);
    const yMax = Math.round(yMaxPx * 20);

    const maxVal = Math.max(Math.abs(xMin), Math.abs(xMax), Math.abs(yMin), Math.abs(yMax));
    let nBits = 1;
    while ((1 << (nBits - 1)) <= maxVal && nBits < 31) {
      nBits++;
    }
    nBits = Math.max(nBits + 1, 5);

    const bw = new BitWriter();
    bw.writeBits(nBits, 5);
    bw.writeSignedBits(xMin, nBits);
    bw.writeSignedBits(xMax, nBits);
    bw.writeSignedBits(yMin, nBits);
    bw.writeSignedBits(yMax, nBits);
    bw.flushByte();
    return bw.toBuffer();
  }

  static encodeTag(tagCode, dataBuf) {
    const len = dataBuf ? dataBuf.length : 0;
    const header = Buffer.alloc(len >= 63 ? 6 : 2);
    if (len >= 63) {
      const codeAndLen = (tagCode << 6) | 0x3F;
      header.writeUInt16LE(codeAndLen, 0);
      header.writeUInt32LE(len, 2);
    } else {
      const codeAndLen = (tagCode << 6) | len;
      header.writeUInt16LE(codeAndLen, 0);
    }
    return dataBuf && dataBuf.length > 0 ? Buffer.concat([header, dataBuf]) : header;
  }

  // Tag 69: FileAttributes (Required for SWF 8+, bit 3 is ActionScript 3.0 flag)
  static encodeFileAttributes(hasMetadata = false, isAS3 = true, useNetwork = false, useDirectBlit = false, useGPU = false) {
    let b0 = 0;
    if (useDirectBlit) b0 |= 0x40;
    if (useGPU) b0 |= 0x20;
    if (hasMetadata) b0 |= 0x10;
    if (isAS3) b0 |= 0x08;
    if (useNetwork) b0 |= 0x01;
    const buf = Buffer.from([b0, 0x00, 0x00, 0x00]);
    return SwfMovie.encodeTag(69, buf);
  }

  // Tag 76: SymbolClass (Associates symbols & main timeline with AS3 classes)
  static encodeSymbolClass(symbols = [{ tagId: 0, className: 'Main' }]) {
    const bw = new BitWriter();
    bw.writeUI16(symbols.length);
    for (const sym of symbols) {
      bw.writeUI16(sym.tagId || 0);
      const nameBuf = Buffer.from((sym.className || 'Main') + '\0', 'utf8');
      bw.writeBytes(nameBuf);
    }
    return SwfMovie.encodeTag(76, bw.toBuffer());
  }

  // Tag 82: DoABC (Delivers ActionScript 3.0 AVM2 bytecode block)
  static encodeDoABC(flags = 0, name = 'frame_1', abcBuffer) {
    const bw = new BitWriter();
    bw.writeUI32(flags);
    const nameBuf = Buffer.from((name || '') + '\0', 'utf8');
    bw.writeBytes(nameBuf);
    if (abcBuffer) {
      bw.writeBytes(abcBuffer);
    }
    return SwfMovie.encodeTag(82, bw.toBuffer());
  }

  static encodeSetBackgroundColor(r, g, b) {
    const buf = Buffer.from([r & 0xFF, g & 0xFF, b & 0xFF]);
    return SwfMovie.encodeTag(9, buf);
  }

  static encodePlaceObject2(depth, charId, x = 0, y = 0) {
    // Flags: HasCharacter (0x02), HasMatrix (0x04)
    const bw = new BitWriter();
    bw.writeUI8(0x06); // HasCharacter | HasMatrix
    bw.writeUI16(depth);
    bw.writeUI16(charId);

    // Matrix: HasScale = 0, HasRotate = 0, HasTranslate = 1
    const xTwips = Math.round(x * 20);
    const yTwips = Math.round(y * 20);
    const maxCoord = Math.max(Math.abs(xTwips), Math.abs(yTwips));
    let nBits = 1;
    while ((1 << (nBits - 1)) <= maxCoord && nBits < 31) nBits++;
    nBits = Math.max(nBits + 1, 5);

    bw.writeBits(0, 1); // HasScale = 0
    bw.writeBits(0, 1); // HasRotate = 0
    bw.writeBits(1, 1); // HasTranslate = 1
    bw.writeBits(nBits, 5);
    bw.writeSignedBits(xTwips, nBits);
    bw.writeSignedBits(yTwips, nBits);
    bw.flushByte();

    return SwfMovie.encodeTag(26, bw.toBuffer());
  }

  static encodeRemoveObject2(depth) {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(depth, 0);
    return SwfMovie.encodeTag(28, buf);
  }

  static encodeShowFrame() {
    return SwfMovie.encodeTag(1, Buffer.alloc(0));
  }

  static encodeEnd() {
    return SwfMovie.encodeTag(0, Buffer.alloc(0));
  }

  // SWF Tag 12: DoAction (ActionScript 1.0/2.0 fallback)
  static encodeDoAction(actions = []) {
    const chunks = [];
    for (const act of actions) {
      if (act === 'stop') chunks.push(Buffer.from([0x07])); // ActionStop
      if (act === 'play') chunks.push(Buffer.from([0x06])); // ActionPlay
    }
    chunks.push(Buffer.from([0x00])); // ActionEnd
    const data = Buffer.concat(chunks);
    return SwfMovie.encodeTag(12, data);
  }

  // Define a vector rectangle shape (Tag 2: DefineShape)
  static encodeDefineRectangleShape(shapeId, width, height, fillColor = { r: 255, g: 0, b: 0 }) {
    const bw = new BitWriter();
    bw.writeUI16(shapeId);

    // Shape bounds RECT
    const bounds = SwfMovie.encodeRect(0, width, 0, height);
    bw.writeBytes(bounds);

    // FillStyles: 1 solid fill
    bw.writeUI8(1); // FillStyleCount = 1
    bw.writeUI8(0x00); // FillStyleType = 0 (solid fill)
    bw.writeUI8(fillColor.r);
    bw.writeUI8(fillColor.g);
    bw.writeUI8(fillColor.b);

    // LineStyles: 0
    bw.writeUI8(0);

    // StyleChangeRecord (TypeFlag=0, NewStyles=0, LineStyle=0, FillStyle1=1, FillStyle0=0, Move=1)
    const wTwips = Math.round(width * 20);
    const hTwips = Math.round(height * 20);

    bw.writeBits(0, 1); // TypeFlag (0 = non-edge)
    bw.writeBits(0, 1); // StateNewStyles
    bw.writeBits(0, 1); // StateLineStyle
    bw.writeBits(1, 1); // StateFillStyle1
    bw.writeBits(0, 1); // StateFillStyle0
    bw.writeBits(1, 1); // StateMoveTo
    bw.writeBits(5, 5); // MoveBits
    bw.writeSignedBits(0, 5); // MoveDeltaX
    bw.writeSignedBits(0, 5); // MoveDeltaY
    bw.writeBits(1, 1); // FillStyle1 = index 1

    // 4 StraightEdgeRecords for rectangle
    const maxD = Math.max(wTwips, hTwips);
    let edgeBits = 1;
    while ((1 << (edgeBits - 1)) <= maxD && edgeBits < 31) edgeBits++;
    edgeBits = Math.max(edgeBits + 1, 5);

    // Top edge: dx = wTwips, dy = 0
    bw.writeBits(1, 1);
    bw.writeBits(1, 1);
    bw.writeBits(edgeBits - 2, 4);
    bw.writeBits(1, 1);
    bw.writeSignedBits(wTwips, edgeBits);
    bw.writeSignedBits(0, edgeBits);

    // Right edge: dx = 0, dy = hTwips
    bw.writeBits(1, 1);
    bw.writeBits(1, 1);
    bw.writeBits(edgeBits - 2, 4);
    bw.writeBits(1, 1);
    bw.writeSignedBits(0, edgeBits);
    bw.writeSignedBits(hTwips, edgeBits);

    // Bottom edge: dx = -wTwips, dy = 0
    bw.writeBits(1, 1);
    bw.writeBits(1, 1);
    bw.writeBits(edgeBits - 2, 4);
    bw.writeBits(1, 1);
    bw.writeSignedBits(-wTwips, edgeBits);
    bw.writeSignedBits(0, edgeBits);

    // Left edge: dx = 0, dy = -hTwips
    bw.writeBits(1, 1);
    bw.writeBits(1, 1);
    bw.writeBits(edgeBits - 2, 4);
    bw.writeBits(1, 1);
    bw.writeSignedBits(0, edgeBits);
    bw.writeSignedBits(-hTwips, edgeBits);

    // EndShapeRecord
    bw.writeBits(0, 6);
    bw.flushByte();

    return SwfMovie.encodeTag(2, bw.toBuffer());
  }

  toBuffer() {
    const frameCount = Math.max(this.frames.length, 1);
    const rectBuf = SwfMovie.encodeRect(0, this.width, 0, this.height);

    const tagChunks = [];

    // Tag 69: FileAttributes must be the first tag in the SWF file
    if (this.as3 || this.version >= 9) {
      tagChunks.push(SwfMovie.encodeFileAttributes(false, this.as3, false, false, false));
    }

    // Background Color tag
    tagChunks.push(SwfMovie.encodeSetBackgroundColor(
      this.backgroundColor.r,
      this.backgroundColor.g,
      this.backgroundColor.b
    ));

    // Compile ActionScript 3 (AVM2 ABC Bytecode) if AS3 enabled
    if (this.as3 && As3Engine) {
      let combinedScript = '';
      this.frames.forEach((f, idx) => {
        if (f.actions) {
          const actStr = Array.isArray(f.actions) ? f.actions.map(a => a + '();').join('\n') : f.actions;
          combinedScript += `// Frame ${idx + 1}\n${actStr}\n`;
        }
      });
      if (!combinedScript.trim()) {
        combinedScript = '// MelFlash Main Timeline Script\nstop();\ntrace("MelFlash AS3 Initialized");';
      }
      const abcBuf = As3Engine.As3Compiler.compile(combinedScript, { className: this.documentClass });
      tagChunks.push(SwfMovie.encodeDoABC(0, 'frame_1', abcBuf));
      tagChunks.push(SwfMovie.encodeSymbolClass([{ tagId: 0, className: this.documentClass }]));
    }

    // Place predefined shapes or elements
    if (this.frames.length === 0) {
      const shapeId = 1;
      tagChunks.push(SwfMovie.encodeDefineRectangleShape(shapeId, 120, 80, { r: 234, g: 88, b: 12 }));
      tagChunks.push(SwfMovie.encodePlaceObject2(1, shapeId, 100, 100));
      tagChunks.push(SwfMovie.encodeShowFrame());
    } else {
      let nextCharId = 1;
      this.frames.forEach((frame, fIdx) => {
        if (frame.elements) {
          frame.elements.forEach((el, elIdx) => {
            const charId = nextCharId++;
            const w = el.w || el.width || 100;
            const h = el.h || el.height || 80;
            let col = { r: 59, g: 130, b: 246 };
            if (el.color) col = el.color;
            else if (el.fill && el.fill.startsWith('#')) {
              col = {
                r: parseInt(el.fill.slice(1, 3), 16) || 0,
                g: parseInt(el.fill.slice(3, 5), 16) || 0,
                b: parseInt(el.fill.slice(5, 7), 16) || 0
              };
            }
            tagChunks.push(SwfMovie.encodeDefineRectangleShape(charId, w, h, col));
            tagChunks.push(SwfMovie.encodePlaceObject2(elIdx + 1, charId, el.x || 50, el.y || 50));
          });
        }
        // AS1/2 fallback if AS3 is disabled
        if (!this.as3 && frame.actions && frame.actions.length > 0) {
          tagChunks.push(SwfMovie.encodeDoAction(frame.actions));
        }
        tagChunks.push(SwfMovie.encodeShowFrame());
      });
    }

    // End tag
    tagChunks.push(SwfMovie.encodeEnd());

    const tagsBuf = Buffer.concat(tagChunks);
    const totalFileLength = 4 + 4 + rectBuf.length + 2 + 2 + tagsBuf.length;

    // Header assembly
    const header = Buffer.alloc(8);
    header.write('FWS', 0, 3, 'ascii'); // Signature
    header.writeUInt8(this.version, 3);
    header.writeUInt32LE(totalFileLength, 4);

    const frameRateBuf = Buffer.alloc(2);
    frameRateBuf.writeUInt16LE(Math.round(this.fps) << 8, 0); // 8.8 fixed point

    const frameCountBuf = Buffer.alloc(2);
    frameCountBuf.writeUInt16LE(frameCount, 0);

    return Buffer.concat([header, rectBuf, frameRateBuf, frameCountBuf, tagsBuf]);
  }

  // SWF Disassembler / Parser
  static parse(buffer) {
    const signature = buffer.slice(0, 3).toString('ascii');
    if (signature !== 'FWS' && signature !== 'CWS') {
      throw new Error(`Invalid SWF signature: ${signature}`);
    }

    const version = buffer.readUInt8(3);
    const fileLength = buffer.readUInt32LE(4);

    let pos = 8;
    // Parse RECT
    const firstByte = buffer.readUInt8(pos);
    const nBits = firstByte >> 3;
    const totalRectBits = 5 + nBits * 4;
    const rectBytes = Math.ceil(totalRectBits / 8);
    pos += rectBytes;

    const fps = buffer.readUInt16LE(pos) >> 8; pos += 2;
    const frameCount = buffer.readUInt16LE(pos); pos += 2;

    const tags = [];
    let fileAttributes = null;
    let symbolClasses = [];
    let abcBlocks = [];

    while (pos < buffer.length) {
      const tagCodeAndLength = buffer.readUInt16LE(pos); pos += 2;
      const tagCode = tagCodeAndLength >> 6;
      let tagLength = tagCodeAndLength & 0x3F;
      if (tagLength === 0x3F) {
        tagLength = buffer.readUInt32LE(pos); pos += 4;
      }
      const tagData = buffer.slice(pos, pos + tagLength);

      let tagInfo = { code: tagCode, length: tagLength, data: tagData };

      // Tag 69: FileAttributes
      if (tagCode === 69 && tagData.length >= 4) {
        fileAttributes = {
          actionScript3: !!(tagData[0] & 0x08),
          hasMetadata: !!(tagData[0] & 0x10),
          useGPU: !!(tagData[0] & 0x20),
          useDirectBlit: !!(tagData[0] & 0x40),
          useNetwork: !!(tagData[0] & 0x01)
        };
        tagInfo.fileAttributes = fileAttributes;
      }

      // Tag 76: SymbolClass
      if (tagCode === 76 && tagData.length >= 2) {
        const numSymbols = tagData.readUInt16LE(0);
        let p = 2;
        const symbols = [];
        for (let i = 0; i < numSymbols && p < tagData.length; i++) {
          const symTag = tagData.readUInt16LE(p); p += 2;
          let end = p;
          while (end < tagData.length && tagData[end] !== 0) end++;
          const symName = tagData.slice(p, end).toString('utf8');
          p = end + 1;
          symbols.push({ tagId: symTag, className: symName });
        }
        symbolClasses.push(...symbols);
        tagInfo.symbols = symbols;
      }

      // Tag 82: DoABC
      if (tagCode === 82 && tagData.length >= 4) {
        const flags = tagData.readUInt32LE(0);
        let p = 4;
        let end = p;
        while (end < tagData.length && tagData[end] !== 0) end++;
        const name = tagData.slice(p, end).toString('utf8');
        p = end + 1;
        const abcBytes = tagData.slice(p);
        let disassembly = null;
        if (As3Engine) {
          try {
            disassembly = As3Engine.As3Disassembler.disassemble(abcBytes);
          } catch (e) {
            disassembly = { error: e.message };
          }
        }
        const abcBlock = { flags, name, byteLength: abcBytes.length, disassembly };
        abcBlocks.push(abcBlock);
        tagInfo.doABC = abcBlock;
      }

      tags.push(tagInfo);
      pos += tagLength;
      if (tagCode === 0) break; // End tag
    }

    return {
      signature,
      version,
      fileLength,
      fps,
      frameCount,
      isActionScript3: !!(fileAttributes && fileAttributes.actionScript3),
      fileAttributes,
      symbolClasses,
      abcBlocks,
      tags
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SwfMovie;
}
if (typeof window !== 'undefined') {
  window.SwfMovie = SwfMovie;
}
