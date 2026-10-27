// MelFlash SWF Binary Encoder & Decoder (Adobe SWF Specification v19 Compliant)

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
    buf.copy(this.buffer, this.byteLength);
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
    this.version = options.version || 10;
    this.width = options.width || 800; // in pixels
    this.height = options.height || 600; // in pixels
    this.fps = options.fps || 24;
    this.backgroundColor = options.backgroundColor || { r: 255, g: 255, b: 255 };
    this.frames = options.frames || []; // Array of frame objects { elements: [], actions: [] }
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

  static encodeDoAction(actions = []) {
    // Actions byte stream
    const chunks = [];
    for (const act of actions) {
      if (act === 'stop') chunks.push(Buffer.from([0x07])); // ActionStop
      if (act === 'play') chunks.push(Buffer.from([0x06])); // ActionPlay
    }
    chunks.push(Buffer.from([0x00])); // ActionEnd
    const data = Buffer.concat(chunks);
    return SwfMovie.encodeTag(12, data);
  }

  // Define a simple vector rectangle shape (Tag 2: DefineShape)
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

    // ShapeRecords:
    // StyleChangeRecord: Select FillStyle 1, MoveTo (0,0)
    // Twip dimensions
    const wTwips = Math.round(width * 20);
    const hTwips = Math.round(height * 20);

    // StyleChangeRecord (TypeFlag=0, NewStyles=0, LineStyle=0, FillStyle1=1, FillStyle0=0, Move=1)
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

    // 4 StraightEdgeRecords for the rectangle
    const maxD = Math.max(wTwips, hTwips);
    let edgeBits = 1;
    while ((1 << (edgeBits - 1)) <= maxD && edgeBits < 31) edgeBits++;
    edgeBits = Math.max(edgeBits + 1, 5);

    // Top edge: dx = wTwips, dy = 0
    bw.writeBits(1, 1); // TypeFlag = 1 (edge)
    bw.writeBits(1, 1); // StraightEdge = 1
    bw.writeBits(edgeBits - 2, 4); // NumBits
    bw.writeBits(1, 1); // GeneralLine = 1
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

    // EndShapeRecord (6 bits of 0)
    bw.writeBits(0, 6);
    bw.flushByte();

    return SwfMovie.encodeTag(2, bw.toBuffer());
  }

  toBuffer() {
    const frameCount = Math.max(this.frames.length, 1);
    const rectBuf = SwfMovie.encodeRect(0, this.width, 0, this.height);

    // Tags payload
    const tagChunks = [];

    // Background Color tag
    tagChunks.push(SwfMovie.encodeSetBackgroundColor(
      this.backgroundColor.r,
      this.backgroundColor.g,
      this.backgroundColor.b
    ));

    // Place predefined shapes or elements
    if (this.frames.length === 0) {
      // Default single frame with a shape
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
            const w = el.w || 100;
            const h = el.h || 80;
            const col = el.color || { r: 59, g: 130, b: 246 };
            tagChunks.push(SwfMovie.encodeDefineRectangleShape(charId, w, h, col));
            tagChunks.push(SwfMovie.encodePlaceObject2(elIdx + 1, charId, el.x || 50, el.y || 50));
          });
        }
        if (frame.actions && frame.actions.length > 0) {
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
    while (pos < buffer.length) {
      const tagCodeAndLength = buffer.readUInt16LE(pos); pos += 2;
      const tagCode = tagCodeAndLength >> 6;
      let tagLength = tagCodeAndLength & 0x3F;
      if (tagLength === 0x3F) {
        tagLength = buffer.readUInt32LE(pos); pos += 4;
      }
      const tagData = buffer.slice(pos, pos + tagLength);
      tags.push({ code: tagCode, length: tagLength, data: tagData });
      pos += tagLength;
      if (tagCode === 0) break; // End tag
    }

    return { signature, version, fileLength, fps, frameCount, tags };
  }
}

module.exports = SwfMovie;
