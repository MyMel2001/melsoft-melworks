// MelSound FL Studio Project (.flp) binary engine - unofficial TLV event-stream format.
// Header chunk: "FLhd" + u32le(6) + u16le(format) + u16le(channels) + u16le(ppq)
// Data chunk:  "FLdt" + u32le(payloadLen) + TLV event stream
// Event IDs 0x01 (fixed, 2B bpm) and 0x02 (fixed, 1B kind) are primitives.
// Event IDs >= 192 use varint length + payload bytes (strings / opaque plugin state).

const FL_HDR_MAGIC = [0x46, 0x4c, 0x68, 0x64]; // "FLhd"
const FL_DATA_MAGIC = [0x46, 0x4c, 0x64, 0x74]; // "FLdt"
const EVENT_TEMPO = 0x01;
const EVENT_KIND = 0x02;
const EVENT_PLUGIN = 0xc0; // varint + opaque blob

const KIND_CODES = { instrumental: 0, vocal: 1, other: 2 };
const KIND_NAMES = ['instrumental', 'vocal', 'other'];

function u16le(value) {
  const b = new Uint8Array(2);
  b[0] = value & 0xff;
  b[1] = Math.floor(value / 256) & 0xff;
  return b;
}

function u32le(value) {
  const b = new Uint8Array(4);
  b[0] = value & 0xff;
  b[1] = Math.floor(value / 256) & 0xff;
  b[2] = Math.floor(value / 65536) & 0xff;
  b[3] = Math.floor(value / 16777216) & 0xff;
  return b;
}

function encodeVarint(value) {
  const out = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

function readVarint(buf, pos) {
  let result = 0;
  let shift = 0;
  let cont = true;
  while (cont) {
    const b = buf[pos++];
    result += (b & 0x7f) * Math.pow(2, shift);
    shift += 7;
    cont = (b & 0x80) !== 0;
  }
  return { value: result, pos };
}

function concatBytes(arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

class MelFlsWriter {
  constructor() {
    this.events = [];
  }

  addTempo(bpm) {
    const clamped = Math.max(1, Math.min(999, Math.round(Number(bpm) || 120)));
    const ev = new Uint8Array(3);
    ev[0] = EVENT_TEMPO;
    ev.set(u16le(clamped), 1);
    this.events.push(ev);
    return this;
  }

  addKind(kind) {
    const code = KIND_CODES[kind] !== undefined ? KIND_CODES[kind] : 0;
    const ev = new Uint8Array([EVENT_KIND, code]);
    this.events.push(ev);
    return this;
  }

  addName(name) {
    const bytes = new TextEncoder ? new TextEncoder().encode(name || '') : Buffer.from(name || '', 'utf8');
    const len = bytes.length;
    const ev = new Uint8Array(2 + len);
    ev[0] = 0xe0;
    const varint = encodeVarint(len);
    ev.set(varint, 1);
    ev.set(bytes, 1 + varint.length);
    this.events.push(ev);
    return this;
  }

  addPluginState(id, bytes) {
    const state = Buffer.from(bytes || []);
    const ev = new Uint8Array(2 + state.length);
    ev[0] = EVENT_PLUGIN;
    const varint = encodeVarint(state.length);
    ev.set(varint, 1);
    for (let i = 0; i < state.length; i++) ev[1 + varint.length + i] = state[i];
    this.events.push(ev);
    return this;
  }

  build() {
    const streamBuf = concatBytes(this.events);
    const headerPayload = new Uint8Array([1, 0, 1, 0, 4, 0]); // format=1, channels=1, ppq=4

    const out = new Uint8Array(22 + streamBuf.length);
    let o = 0;
    out.set(FL_HDR_MAGIC, o); o += 4;
    out.set(u32le(6), o); o += 4;
    out.set(headerPayload, o); o += 6;
    out.set(FL_DATA_MAGIC, o); o += 4;
    out.set(u32le(streamBuf.length), o); o += 4;
    out.set(streamBuf, o);
    return out;
  }
}

class MelFlsReader {
  static parse(buffer) {
    const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (buf.length < 22) throw new Error('FLP file too short');
    for (let i = 0; i < 4; i++) {
      if (buf[i] !== FL_HDR_MAGIC[i]) throw new Error('Invalid FLP header magic');
    }
    const hdrSize = buf[4] | (buf[5] << 8) | (buf[6] << 16) | (buf[7] << 24);
    if (hdrSize !== 6) throw new Error('Invalid FLP header size');
    for (let i = 0; i < 4; i++) {
      if (buf[14 + i] !== FL_DATA_MAGIC[i]) throw new Error('Invalid FLP data magic');
    }
    const dataBytes = buf[18] | (buf[19] << 8) | (buf[20] << 16) | (buf[21] << 24);
    const stream = buf.subarray(22, 22 + dataBytes);
    if (stream.length < 1) throw new Error('Empty FLP event stream');

    const result = { bpm: 120, kindCode: 0, name: '', pluginStates: [] };
    let pos = 0;
    while (pos < stream.length) {
      const id = stream[pos++];
      if (id >= 192) {
        const v = readVarint(stream, pos);
        pos = v.pos;
        const payload = stream.subarray(pos, pos + v.value);
        pos += v.value;
        if (id === EVENT_PLUGIN) {
          result.pluginStates.push({ blobId: result.pluginStates.length, bytes: Array.from(payload) });
        } else {
          result.name = new TextDecoder ? new TextDecoder().decode(payload) : '';
        }
        continue;
      }
      let size = 0;
      if (id === EVENT_TEMPO) size = 2;
      else if (id === EVENT_KIND) size = 1;
      else throw new Error('Unsupported fixed FLP event id: ' + id);
      const value = stream[pos] | (stream[pos + 1] << 8);
      if (id === EVENT_TEMPO) result.bpm = value;
      if (id === EVENT_KIND) result.kindCode = stream[pos];
      pos += size;
    }
    result.kind = KIND_NAMES[result.kindCode] || 'instrumental';
    return result;
  }
}

module.exports = { MelFlsWriter, MelFlsReader, KIND_CODES, KIND_NAMES, EVENT_TEMPO, EVENT_KIND, EVENT_PLUGIN };
