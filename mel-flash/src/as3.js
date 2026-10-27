// MelFlash ActionScript 3 (AS3) & AVM2 Bytecode Compilation and Runtime Engine
// Specifications:
// - ActionScript 3.0 Language Reference & Specifications
// - Adobe ActionScript Virtual Machine 2 (AVM2) Overview (2007-05)
// - SWF File Format Specification Version 19 (DoABC Tag 82, SymbolClass Tag 76, FileAttributes Tag 69)

// --- AVM2 Instruction Set Opcode Constants ---
const AVM2_OPS = {
  bkpt: 0x01,
  nop: 0x02,
  throw: 0x03,
  getsuper: 0x04,
  setsuper: 0x05,
  dxns: 0x06,
  dxnslate: 0x07,
  kill: 0x08,
  label: 0x09,
  ifnlt: 0x0c,
  ifnle: 0x0d,
  ifngt: 0x0e,
  ifnge: 0x0f,
  jump: 0x10,
  iftrue: 0x11,
  iffalse: 0x12,
  ifeq: 0x13,
  ifne: 0x14,
  iflt: 0x15,
  ifle: 0x16,
  ifgt: 0x17,
  ifge: 0x18,
  ifstricteq: 0x19,
  ifstrictne: 0x1a,
  lookupswitch: 0x1b,
  pushwith: 0x1c,
  popscope: 0x1d,
  nextname: 0x1e,
  hasnext: 0x1f,
  pushnull: 0x20,
  pushundefined: 0x21,
  nextvalue: 0x23,
  pushbyte: 0x24,
  pushshort: 0x25,
  pushtrue: 0x26,
  pushfalse: 0x27,
  pushnan: 0x28,
  pop: 0x29,
  dup: 0x2a,
  swap: 0x2b,
  pushstring: 0x2c,
  pushint: 0x2d,
  pushuint: 0x2e,
  pushdouble: 0x2f,
  pushscope: 0x30,
  pushnamespace: 0x31,
  hasnext2: 0x32,
  newfunction: 0x40,
  call: 0x41,
  construct: 0x42,
  callmethod: 0x43,
  callstatic: 0x44,
  callsuper: 0x45,
  callproperty: 0x46,
  returnvoid: 0x47,
  returnvalue: 0x48,
  constructsuper: 0x49,
  constructprop: 0x4a,
  callproplex: 0x4c,
  callsupervoid: 0x4e,
  callpropvoid: 0x4f,
  newobject: 0x55,
  newarray: 0x56,
  newactivation: 0x57,
  newclass: 0x58,
  getdescendants: 0x59,
  newcatch: 0x5a,
  findpropstrict: 0x5d,
  findproperty: 0x5e,
  getlex: 0x60,
  setproperty: 0x61,
  getlocal: 0x62,
  setlocal: 0x63,
  getglobalscope: 0x64,
  getscopeobject: 0x65,
  getproperty: 0x66,
  initproperty: 0x68,
  deleteproperty: 0x6a,
  getslot: 0x6c,
  setslot: 0x6d,
  getglobalslot: 0x6e,
  setglobalslot: 0x6f,
  convert_s: 0x70,
  esc_xelem: 0x71,
  esc_xattr: 0x72,
  convert_i: 0x73,
  convert_u: 0x74,
  convert_d: 0x75,
  convert_b: 0x76,
  convert_o: 0x77,
  checkfilter: 0x78,
  coerce: 0x80,
  coerce_a: 0x82,
  coerce_s: 0x85,
  astype: 0x86,
  astypelate: 0x87,
  negate: 0x90,
  increment: 0x91,
  inclocal: 0x92,
  decrement: 0x93,
  declocal: 0x94,
  typeof: 0x95,
  not: 0x96,
  bitnot: 0x97,
  add: 0xa0,
  subtract: 0xa1,
  multiply: 0xa2,
  divide: 0xa3,
  modulo: 0xa4,
  lshift: 0xa5,
  rshift: 0xa6,
  urshift: 0xa7,
  bitand: 0xa8,
  bitor: 0xa9,
  bitxor: 0xaa,
  equals: 0xab,
  strictequals: 0xac,
  lessthan: 0xad,
  lessequals: 0xae,
  greaterthan: 0xaf,
  greaterequals: 0xb0,
  instanceof: 0xb1,
  istype: 0xb2,
  istypelate: 0xb3,
  in: 0xb4,
  increment_i: 0xc0,
  decrement_i: 0xc1,
  inclocal_i: 0xc2,
  declocal_i: 0xc3,
  negate_i: 0xc4,
  add_i: 0xc5,
  subtract_i: 0xc6,
  multiply_i: 0xc7,
  getlocal_0: 0xd0,
  getlocal_1: 0xd1,
  getlocal_2: 0xd2,
  getlocal_3: 0xd3,
  setlocal_0: 0xd4,
  setlocal_1: 0xd5,
  setlocal_2: 0xd6,
  setlocal_3: 0xd7,
  debug: 0xef
};

const AVM2_NAMES = {};
for (const [k, v] of Object.entries(AVM2_OPS)) {
  AVM2_NAMES[v] = k;
}

// --- Binary Serializer & Deserializer for AVM2 ABC Format ---
class ByteWriter {
  constructor(initialCapacity = 4096) {
    this.capacity = initialCapacity;
    this.buffer = new Uint8Array(this.capacity);
    this.length = 0;
  }

  ensureCapacity(extra) {
    if (this.length + extra > this.capacity) {
      this.capacity = Math.max(this.capacity * 2, this.capacity + extra + 1024);
      const newBuf = new Uint8Array(this.capacity);
      newBuf.set(this.buffer.subarray(0, this.length));
      this.buffer = newBuf;
    }
  }

  writeU8(val) {
    this.ensureCapacity(1);
    this.buffer[this.length++] = val & 0xFF;
  }

  writeU16(val) {
    this.ensureCapacity(2);
    this.buffer[this.length++] = val & 0xFF;
    this.buffer[this.length++] = (val >> 8) & 0xFF;
  }

  writeU32(val) {
    this.ensureCapacity(4);
    this.buffer[this.length++] = val & 0xFF;
    this.buffer[this.length++] = (val >> 8) & 0xFF;
    this.buffer[this.length++] = (val >> 16) & 0xFF;
    this.buffer[this.length++] = (val >>> 24) & 0xFF;
  }

  writeS24(val) {
    this.ensureCapacity(3);
    this.buffer[this.length++] = val & 0xFF;
    this.buffer[this.length++] = (val >> 8) & 0xFF;
    this.buffer[this.length++] = (val >> 16) & 0xFF;
  }

  writeU30(val) {
    val = val >>> 0;
    while (val > 0x7F) {
      this.writeU8((val & 0x7F) | 0x80);
      val >>>= 7;
    }
    this.writeU8(val & 0x7F);
  }

  writeDouble(val) {
    this.ensureCapacity(8);
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, val, true);
    for (let i = 0; i < 8; i++) {
      this.buffer[this.length++] = view.getUint8(i);
    }
  }

  writeBytes(bytes) {
    if (!bytes || bytes.length === 0) return;
    this.ensureCapacity(bytes.length);
    if (bytes instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(bytes))) {
      this.buffer.set(bytes, this.length);
      this.length += bytes.length;
    } else {
      for (let i = 0; i < bytes.length; i++) {
        this.buffer[this.length++] = bytes[i];
      }
    }
  }

  writeUTF(str) {
    let bytes;
    if (typeof Buffer !== 'undefined') {
      bytes = Buffer.from(str, 'utf8');
    } else {
      bytes = new TextEncoder().encode(str);
    }
    this.writeU30(bytes.length);
    this.writeBytes(bytes);
  }

  toBuffer() {
    const slice = this.buffer.subarray(0, this.length);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength);
    }
    return slice;
  }
}

class ByteReader {
  constructor(buffer) {
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
      this.bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer instanceof Uint8Array) {
      this.bytes = buffer;
    } else {
      this.bytes = new Uint8Array(buffer);
    }
    this.pos = 0;
  }

  readU8() {
    return this.bytes[this.pos++];
  }

  readU16() {
    const val = this.bytes[this.pos] | (this.bytes[this.pos + 1] << 8);
    this.pos += 2;
    return val;
  }

  readU32() {
    const val = (this.bytes[this.pos] |
      (this.bytes[this.pos + 1] << 8) |
      (this.bytes[this.pos + 2] << 16) |
      (this.bytes[this.pos + 3] << 24)) >>> 0;
    this.pos += 4;
    return val;
  }

  readS24() {
    let val = this.bytes[this.pos] | (this.bytes[this.pos + 1] << 8) | (this.bytes[this.pos + 2] << 16);
    this.pos += 3;
    if (val & 0x800000) val |= ~0xFFFFFF;
    return val;
  }

  readU30() {
    let val = 0;
    let shift = 0;
    while (true) {
      const b = this.bytes[this.pos++];
      val |= (b & 0x7F) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    return val >>> 0;
  }

  readDouble() {
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 8);
    this.pos += 8;
    return view.getFloat64(0, true);
  }

  readBytes(count) {
    const slice = this.bytes.subarray(this.pos, this.pos + count);
    this.pos += count;
    return slice;
  }

  readUTF(len) {
    const bytes = this.readBytes(len);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('utf8');
    }
    return new TextDecoder().decode(bytes);
  }
}

// --- AVM2 ABC Structure Builder ---
class AbcFileBuilder {
  constructor() {
    this.integers = [];
    this.uintegers = [];
    this.doubles = [];
    this.strings = [];
    this.namespaces = [];
    this.nsSets = [];
    this.multinames = [];

    this.methods = [];
    this.metadata = [];
    this.classes = [];
    this.scripts = [];
    this.methodBodies = [];
  }

  addString(str) {
    if (!str && str !== '') return 0;
    const idx = this.strings.indexOf(str);
    if (idx !== -1) return idx + 1;
    this.strings.push(str);
    return this.strings.length;
  }

  addInt(val) {
    val = Math.trunc(val);
    const idx = this.integers.indexOf(val);
    if (idx !== -1) return idx + 1;
    this.integers.push(val);
    return this.integers.length;
  }

  addUint(val) {
    val = (val >>> 0);
    const idx = this.uintegers.indexOf(val);
    if (idx !== -1) return idx + 1;
    this.uintegers.push(val);
    return this.uintegers.length;
  }

  addDouble(val) {
    const idx = this.doubles.indexOf(val);
    if (idx !== -1) return idx + 1;
    this.doubles.push(val);
    return this.doubles.length;
  }

  addNamespace(kind, nameStr) {
    const nameIdx = this.addString(nameStr);
    for (let i = 0; i < this.namespaces.length; i++) {
      if (this.namespaces[i].kind === kind && this.namespaces[i].name === nameIdx) {
        return i + 1;
      }
    }
    this.namespaces.push({ kind, name: nameIdx });
    return this.namespaces.length;
  }

  addNsSet(nsIndices) {
    for (let i = 0; i < this.nsSets.length; i++) {
      const set = this.nsSets[i];
      if (set.length === nsIndices.length && set.every((v, j) => v === nsIndices[j])) {
        return i + 1;
      }
    }
    this.nsSets.push([...nsIndices]);
    return this.nsSets.length;
  }

  addQName(nsIdx, nameStr) {
    const nameIdx = this.addString(nameStr);
    for (let i = 0; i < this.multinames.length; i++) {
      const mn = this.multinames[i];
      if (mn.kind === 0x07 && mn.ns === nsIdx && mn.name === nameIdx) {
        return i + 1;
      }
    }
    this.multinames.push({ kind: 0x07, ns: nsIdx, name: nameIdx });
    return this.multinames.length;
  }

  addMultiname(nsSetIdx, nameStr) {
    const nameIdx = this.addString(nameStr);
    for (let i = 0; i < this.multinames.length; i++) {
      const mn = this.multinames[i];
      if (mn.kind === 0x09 && mn.nsSet === nsSetIdx && mn.name === nameIdx) {
        return i + 1;
      }
    }
    this.multinames.push({ kind: 0x09, nsSet: nsSetIdx, name: nameIdx });
    return this.multinames.length;
  }

  addMethod(name, paramTypes = [], returnType = 0, flags = 0) {
    const nameIdx = this.addString(name);
    const methodIdx = this.methods.length;
    this.methods.push({
      paramCount: paramTypes.length,
      returnType: returnType,
      paramTypes: paramTypes,
      name: nameIdx,
      flags: flags
    });
    return methodIdx;
  }

  addClass(instanceInfo, classInfo) {
    const classIdx = this.classes.length;
    this.classes.push({
      instance: instanceInfo,
      class: classInfo
    });
    return classIdx;
  }

  addScript(initMethodIdx, traits = []) {
    const scriptIdx = this.scripts.length;
    this.scripts.push({
      init: initMethodIdx,
      traits: traits
    });
    return scriptIdx;
  }

  addMethodBody(methodIdx, maxStack, localCount, initScope, maxScope, codeBytes) {
    const mbIdx = this.methodBodies.length;
    this.methodBodies.push({
      method: methodIdx,
      maxStack: maxStack,
      localCount: localCount,
      initScopeDepth: initScope,
      maxScopeDepth: maxScope,
      code: codeBytes,
      exceptions: [],
      traits: []
    });
    return mbIdx;
  }

  toBuffer() {
    const bw = new ByteWriter();
    // minor: 16 (0x10), major: 46 (0x2E)
    bw.writeU16(16);
    bw.writeU16(46);

    // cpool_info
    // integers
    if (this.integers.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.integers.length + 1);
      for (const val of this.integers) {
        bw.writeU30(val);
      }
    }

    // uintegers
    if (this.uintegers.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.uintegers.length + 1);
      for (const val of this.uintegers) {
        bw.writeU30(val);
      }
    }

    // doubles
    if (this.doubles.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.doubles.length + 1);
      for (const val of this.doubles) {
        bw.writeDouble(val);
      }
    }

    // strings
    if (this.strings.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.strings.length + 1);
      for (const str of this.strings) {
        bw.writeUTF(str);
      }
    }

    // namespaces
    if (this.namespaces.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.namespaces.length + 1);
      for (const ns of this.namespaces) {
        bw.writeU8(ns.kind);
        bw.writeU30(ns.name);
      }
    }

    // ns_sets
    if (this.nsSets.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.nsSets.length + 1);
      for (const set of this.nsSets) {
        bw.writeU30(set.length);
        for (const nsIdx of set) {
          bw.writeU30(nsIdx);
        }
      }
    }

    // multinames
    if (this.multinames.length === 0) {
      bw.writeU30(0);
    } else {
      bw.writeU30(this.multinames.length + 1);
      for (const mn of this.multinames) {
        bw.writeU8(mn.kind);
        if (mn.kind === 0x07 || mn.kind === 0x0D) {
          bw.writeU30(mn.ns);
          bw.writeU30(mn.name);
        } else if (mn.kind === 0x09 || mn.kind === 0x0E) {
          bw.writeU30(mn.name);
          bw.writeU30(mn.nsSet);
        } else if (mn.kind === 0x1B || mn.kind === 0x1C) {
          bw.writeU30(mn.nsSet);
        }
      }
    }

    // methods
    bw.writeU30(this.methods.length);
    for (const m of this.methods) {
      bw.writeU30(m.paramCount);
      bw.writeU30(m.returnType);
      for (const pt of m.paramTypes) {
        bw.writeU30(pt);
      }
      bw.writeU30(m.name);
      bw.writeU8(m.flags);
    }

    // metadata
    bw.writeU30(0);

    // classes
    bw.writeU30(this.classes.length);
    // instances
    for (const c of this.classes) {
      const inst = c.instance;
      bw.writeU30(inst.name);
      bw.writeU30(inst.superName);
      bw.writeU8(inst.flags || 0);
      if (inst.flags & 0x08) {
        bw.writeU30(inst.protectedNs || 0);
      }
      bw.writeU30((inst.interfaces || []).length);
      for (const iface of (inst.interfaces || [])) {
        bw.writeU30(iface);
      }
      bw.writeU30(inst.iinit);
      const traits = inst.traits || [];
      bw.writeU30(traits.length);
      for (const t of traits) {
        AbcFileBuilder.writeTrait(bw, t);
      }
    }
    // classes static
    for (const c of this.classes) {
      const cl = c.class;
      bw.writeU30(cl.cinit);
      const traits = cl.traits || [];
      bw.writeU30(traits.length);
      for (const t of traits) {
        AbcFileBuilder.writeTrait(bw, t);
      }
    }

    // scripts
    bw.writeU30(this.scripts.length);
    for (const s of this.scripts) {
      bw.writeU30(s.init);
      const traits = s.traits || [];
      bw.writeU30(traits.length);
      for (const t of traits) {
        AbcFileBuilder.writeTrait(bw, t);
      }
    }

    // method bodies
    bw.writeU30(this.methodBodies.length);
    for (const mb of this.methodBodies) {
      bw.writeU30(mb.method);
      bw.writeU30(mb.maxStack);
      bw.writeU30(mb.localCount);
      bw.writeU30(mb.initScopeDepth);
      bw.writeU30(mb.maxScopeDepth);
      bw.writeU30(mb.code.length);
      bw.writeBytes(mb.code);
      bw.writeU30(0); // exception_count
      bw.writeU30(0); // trait_count
    }

    return bw.toBuffer();
  }

  static writeTrait(bw, trait) {
    bw.writeU30(trait.name);
    bw.writeU8(trait.kind);
    const type = trait.kind & 0x0F;
    if (type === 0 || type === 6) { // Slot or Const
      bw.writeU30(trait.slotId || 0);
      bw.writeU30(trait.typeName || 0);
      bw.writeU30(trait.vindex || 0);
      if (trait.vindex) bw.writeU8(trait.vkind || 0);
    } else if (type === 1 || type === 2 || type === 3) { // Method, Getter, Setter
      bw.writeU30(trait.dispId || 0);
      bw.writeU30(trait.method);
    } else if (type === 4) { // Class
      bw.writeU30(trait.slotId || 0);
      bw.writeU30(trait.classi);
    } else if (type === 5) { // Function
      bw.writeU30(trait.slotId || 0);
      bw.writeU30(trait.function);
    }
  }
}

// --- ActionScript 3 Lexer / Tokenizer ---
class As3Tokenizer {
  constructor(source) {
    this.source = source || '';
    this.pos = 0;
    this.line = 1;
    this.column = 1;
  }

  peekChar() {
    return this.pos < this.source.length ? this.source[this.pos] : null;
  }

  nextChar() {
    if (this.pos >= this.source.length) return null;
    const ch = this.source[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this.peekChar();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.nextChar();
      } else if (ch === '/' && this.source[this.pos + 1] === '/') {
        // Single-line comment
        while (this.pos < this.source.length && this.peekChar() !== '\n') {
          this.nextChar();
        }
      } else if (ch === '/' && this.source[this.pos + 1] === '*') {
        // Multi-line comment
        this.nextChar();
        this.nextChar();
        while (this.pos < this.source.length) {
          if (this.peekChar() === '*' && this.source[this.pos + 1] === '/') {
            this.nextChar();
            this.nextChar();
            break;
          }
          this.nextChar();
        }
      } else {
        break;
      }
    }
  }

  tokenize() {
    const tokens = [];
    while (true) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const line = this.line;
      const column = this.column;
      const ch = this.peekChar();

      // Number literal
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.source[this.pos + 1]))) {
        let numStr = '';
        if (ch === '0' && (this.source[this.pos + 1] === 'x' || this.source[this.pos + 1] === 'X')) {
          numStr += this.nextChar() + this.nextChar();
          while (/[0-9a-fA-F]/.test(this.peekChar())) numStr += this.nextChar();
        } else {
          while (/[0-9]/.test(this.peekChar())) numStr += this.nextChar();
          if (this.peekChar() === '.') {
            numStr += this.nextChar();
            while (/[0-9]/.test(this.peekChar())) numStr += this.nextChar();
          }
        }
        tokens.push({ type: 'NUMBER', value: Number(numStr), raw: numStr, line, column });
        continue;
      }

      // String literal
      if (ch === '"' || ch === "'") {
        const quote = this.nextChar();
        let str = '';
        while (this.pos < this.source.length && this.peekChar() !== quote) {
          let c = this.nextChar();
          if (c === '\\') {
            const next = this.nextChar();
            if (next === 'n') str += '\n';
            else if (next === 't') str += '\t';
            else if (next === 'r') str += '\r';
            else if (next === '\\') str += '\\';
            else if (next === quote) str += quote;
            else str += next;
          } else {
            str += c;
          }
        }
        if (this.peekChar() === quote) this.nextChar();
        tokens.push({ type: 'STRING', value: str, line, column });
        continue;
      }

      // Identifiers and Keywords
      if (/[a-zA-Z_$]/.test(ch)) {
        let id = '';
        while (this.pos < this.source.length && /[a-zA-Z0-9_$]/.test(this.peekChar())) {
          id += this.nextChar();
        }
        tokens.push({ type: 'IDENT', value: id, line, column });
        continue;
      }

      // Multi-character punctuation / operators
      const two = this.source.slice(this.pos, this.pos + 2);
      const three = this.source.slice(this.pos, this.pos + 3);

      if (three === '===' || three === '!==' || three === '>>>') {
        this.pos += 3; this.column += 3;
        tokens.push({ type: 'OP', value: three, line, column });
        continue;
      }

      if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '<<', '>>'].includes(two)) {
        this.pos += 2; this.column += 2;
        tokens.push({ type: 'OP', value: two, line, column });
        continue;
      }

      // Single-character punctuation / operators
      this.nextChar();
      tokens.push({ type: 'PUNCT', value: ch, line, column });
    }
    tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column });
    return tokens;
  }
}

// --- ActionScript 3 Parser ---
class As3Parser {
  constructor(tokens) {
    this.tokens = tokens || [];
    this.idx = 0;
  }

  peek() {
    return this.tokens[this.idx] || { type: 'EOF', value: '' };
  }

  consume() {
    return this.tokens[this.idx++];
  }

  match(val) {
    const t = this.peek();
    if (t.value === val) {
      this.consume();
      return true;
    }
    return false;
  }

  expect(val) {
    const t = this.peek();
    if (t.value !== val) {
      throw new Error(`Parse error at line ${t.line}, col ${t.column}: expected '${val}', got '${t.value}'`);
    }
    return this.consume();
  }

  parseProgram() {
    const body = [];
    while (this.peek().type !== 'EOF') {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    return { type: 'Program', body };
  }

  parseStatement() {
    while (this.match(';')) {}
    const t = this.peek();
    if (t.type === 'EOF') return null;

    // package declaration
    if (t.value === 'package') {
      this.consume();
      let pkgName = '';
      if (this.peek().value !== '{') {
        pkgName = this.parseQualifiedName();
      }
      this.expect('{');
      const inner = [];
      while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
        inner.push(this.parseStatement());
      }
      this.expect('}');
      return { type: 'PackageDeclaration', name: pkgName, body: inner };
    }

    // import
    if (t.value === 'import') {
      this.consume();
      let name = this.parseQualifiedName();
      if (this.match('.')) {
        if (this.match('*')) name += '.*';
      }
      this.match(';');
      return { type: 'ImportDeclaration', name };
    }

    // class declaration
    if (['public', 'internal', 'final', 'dynamic'].includes(t.value) && this.tokens[this.idx + 1]?.value === 'class') {
      this.consume(); // modifier
    }
    if (this.peek().value === 'class') {
      this.consume();
      const className = this.expectIdentifier();
      let superName = 'MovieClip';
      if (this.match('extends')) {
        superName = this.parseQualifiedName();
      }
      let interfaces = [];
      if (this.match('implements')) {
        interfaces.push(this.parseQualifiedName());
        while (this.match(',')) interfaces.push(this.parseQualifiedName());
      }
      this.expect('{');
      const members = [];
      while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
        members.push(this.parseStatement());
      }
      this.expect('}');
      return { type: 'ClassDeclaration', name: className, superName, interfaces, members };
    }

    // var or const
    if (['public', 'private', 'protected', 'static'].includes(t.value) && ['var', 'const', 'function'].includes(this.tokens[this.idx + 1]?.value)) {
      this.consume(); // modifier
    }
    if (this.peek().value === 'var' || this.peek().value === 'const') {
      const isConst = (this.consume().value === 'const');
      const name = this.expectIdentifier();
      let varType = '*';
      if (this.match(':')) {
        varType = this.parseTypeAnnotation();
      }
      let init = null;
      if (this.match('=')) {
        init = this.parseExpression();
      }
      this.match(';');
      return { type: 'VariableDeclaration', name, varType, init, isConst };
    }

    // function
    if (this.peek().value === 'function') {
      this.consume();
      const name = (this.peek().type === 'IDENT') ? this.consume().value : '';
      this.expect('(');
      const params = [];
      while (this.peek().value !== ')' && this.peek().type !== 'EOF') {
        const pName = this.expectIdentifier();
        let pType = '*';
        if (this.match(':')) pType = this.parseTypeAnnotation();
        params.push({ name: pName, type: pType });
        if (!this.match(',')) break;
      }
      this.expect(')');
      let returnType = 'void';
      if (this.match(':')) returnType = this.parseTypeAnnotation();
      this.expect('{');
      const body = [];
      while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
        body.push(this.parseStatement());
      }
      this.expect('}');
      return { type: 'FunctionDeclaration', name, params, returnType, body };
    }

    // if / else
    if (this.peek().value === 'if') {
      this.consume();
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      const consequent = this.parseStatement();
      let alternate = null;
      if (this.match('else')) {
        alternate = this.parseStatement();
      }
      return { type: 'IfStatement', test, consequent, alternate };
    }

    // while
    if (this.peek().value === 'while') {
      this.consume();
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      const body = this.parseStatement();
      return { type: 'WhileStatement', test, body };
    }

    // for
    if (this.peek().value === 'for') {
      this.consume();
      this.expect('(');
      let init = null;
      if (this.peek().value === 'var') init = this.parseStatement();
      else if (this.peek().value !== ';') {
        init = this.parseExpression();
        this.match(';');
      } else {
        this.consume();
      }
      let test = null;
      if (this.peek().value !== ';') test = this.parseExpression();
      this.expect(';');
      let update = null;
      if (this.peek().value !== ')') update = this.parseExpression();
      this.expect(')');
      const body = this.parseStatement();
      return { type: 'ForStatement', init, test, update, body };
    }

    // return
    if (this.peek().value === 'return') {
      this.consume();
      let argument = null;
      if (this.peek().value !== ';' && this.peek().value !== '}') {
        argument = this.parseExpression();
      }
      this.match(';');
      return { type: 'ReturnStatement', argument };
    }

    // Block
    if (this.peek().value === '{') {
      this.consume();
      const stmts = [];
      while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
        stmts.push(this.parseStatement());
      }
      this.expect('}');
      return { type: 'BlockStatement', body: stmts };
    }

    // Expression statement
    const expr = this.parseExpression();
    this.match(';');
    return { type: 'ExpressionStatement', expression: expr };
  }

  parseQualifiedName() {
    let name = this.expectIdentifier();
    while (this.peek().value === '.' && this.tokens[this.idx + 1]?.value !== '*') {
      this.consume();
      name += '.' + this.expectIdentifier();
    }
    return name;
  }

  parseTypeAnnotation() {
    let name = this.expectIdentifier();
    if (name === 'Vector' && this.match('.<')) {
      name += '.<' + this.parseTypeAnnotation() + '>';
      this.expect('>');
    }
    return name;
  }

  expectIdentifier() {
    const t = this.peek();
    if (t.type !== 'IDENT' && t.type !== 'NUMBER' && t.value !== '*') {
      throw new Error(`Parse error at line ${t.line}, col ${t.column}: expected identifier, got '${t.value}'`);
    }
    return this.consume().value;
  }

  parseExpression() {
    return this.parseAssignment();
  }

  parseAssignment() {
    let left = this.parseLogicalOr();
    const t = this.peek();
    if (['=', '+=', '-=', '*=', '/=', '%='].includes(t.value)) {
      const op = this.consume().value;
      const right = this.parseAssignment();
      return { type: 'AssignmentExpression', operator: op, left, right };
    }
    return left;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.peek().value === '||') {
      const op = this.consume().value;
      const right = this.parseLogicalAnd();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.peek().value === '&&') {
      const op = this.consume().value;
      const right = this.parseEquality();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseRelational();
    while (['==', '!=', '===', '!=='].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseRelational();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseRelational() {
    let left = this.parseAdditive();
    while (['<', '<=', '>', '>=', 'is', 'as'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseAdditive();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (['+', '-'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (['*', '/', '%'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (['!', '-', '+', '++', '--'].includes(this.peek().value)) {
      const op = this.consume().value;
      const arg = this.parseUnary();
      return { type: 'UnaryExpression', operator: op, argument: arg, prefix: true };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match('.')) {
        const prop = this.expectIdentifier();
        expr = { type: 'MemberExpression', object: expr, property: { type: 'Identifier', name: prop }, computed: false };
      } else if (this.match('[')) {
        const prop = this.parseExpression();
        this.expect(']');
        expr = { type: 'MemberExpression', object: expr, property: prop, computed: true };
      } else if (this.match('(')) {
        const args = [];
        while (this.peek().value !== ')' && this.peek().type !== 'EOF') {
          args.push(this.parseExpression());
          if (!this.match(',')) break;
        }
        this.expect(')');
        expr = { type: 'CallExpression', callee: expr, arguments: args };
      } else if (this.peek().value === '++' || this.peek().value === '--') {
        const op = this.consume().value;
        expr = { type: 'UpdateExpression', operator: op, argument: expr, prefix: false };
      } else {
        break;
      }
    }
    return expr;
  }

  parsePrimary() {
    const t = this.peek();
    if (t.type === 'NUMBER') {
      return { type: 'Literal', value: this.consume().value };
    }
    if (t.type === 'STRING') {
      return { type: 'Literal', value: this.consume().value };
    }
    if (t.value === 'true' || t.value === 'false') {
      return { type: 'Literal', value: (this.consume().value === 'true') };
    }
    if (t.value === 'null') {
      this.consume();
      return { type: 'Literal', value: null };
    }
    if (t.value === 'undefined') {
      this.consume();
      return { type: 'Literal', value: undefined };
    }
    if (t.value === 'new') {
      this.consume();
      const callee = this.parseQualifiedName();
      this.expect('(');
      const args = [];
      while (this.peek().value !== ')' && this.peek().type !== 'EOF') {
        args.push(this.parseExpression());
        if (!this.match(',')) break;
      }
      this.expect(')');
      return { type: 'NewExpression', callee: { type: 'Identifier', name: callee }, arguments: args };
    }
    if (t.value === 'function') {
      return this.parseFunctionExpression();
    }
    if (t.value === '(') {
      this.consume();
      const expr = this.parseExpression();
      this.expect(')');
      return expr;
    }
    if (t.value === '[') {
      this.consume();
      const elements = [];
      while (this.peek().value !== ']' && this.peek().type !== 'EOF') {
        elements.push(this.parseExpression());
        if (!this.match(',')) break;
      }
      this.expect(']');
      return { type: 'ArrayExpression', elements };
    }
    if (t.value === '{') {
      this.consume();
      const properties = [];
      while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
        const key = this.expectIdentifier();
        this.expect(':');
        const val = this.parseExpression();
        properties.push({ key, value: val });
        if (!this.match(',')) break;
      }
      this.expect('}');
      return { type: 'ObjectExpression', properties };
    }
    if (t.type === 'IDENT' || t.value === 'this' || t.value === 'super') {
      return { type: 'Identifier', name: this.consume().value };
    }

    throw new Error(`Unexpected token at line ${t.line}, col ${t.column}: '${t.value}'`);
  }

  parseFunctionExpression() {
    this.expect('function');
    let name = '';
    if (this.peek().type === 'IDENT' && this.peek().value !== '(') {
      name = this.consume().value;
    }
    this.expect('(');
    const params = [];
    while (this.peek().value !== ')' && this.peek().type !== 'EOF') {
      const pName = this.expectIdentifier();
      let pType = '*';
      if (this.match(':')) pType = this.parseTypeAnnotation();
      params.push({ name: pName, type: pType });
      if (!this.match(',')) break;
    }
    this.expect(')');
    let returnType = 'void';
    if (this.match(':')) returnType = this.parseTypeAnnotation();
    this.expect('{');
    const body = [];
    while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
      body.push(this.parseStatement());
    }
    this.expect('}');
    return { type: 'FunctionExpression', name, params, returnType, body };
  }
}

// --- ActionScript 3 to AVM2 ABC Compiler ---
class As3Compiler {
  static compile(source, options = {}) {
    const tokenizer = new As3Tokenizer(source);
    const tokens = tokenizer.tokenize();
    const parser = new As3Parser(tokens);
    const ast = parser.parseProgram();

    const builder = new AbcFileBuilder();
    const pkgNs = builder.addNamespace(0x16, ''); // default package namespace

    // Look for class or frame script
    let classDecl = null;
    let statements = [];

    for (const node of ast.body) {
      if (node.type === 'PackageDeclaration') {
        for (const inner of node.body) {
          if (inner.type === 'ClassDeclaration') classDecl = inner;
        }
      } else if (node.type === 'ClassDeclaration') {
        classDecl = node;
      } else {
        statements.push(node);
      }
    }

    const className = classDecl ? classDecl.name : (options.className || 'Main');
    const superClassName = classDecl ? classDecl.superName : 'MovieClip';

    const classQName = builder.addQName(pkgNs, className);
    const superQName = builder.addQName(pkgNs, superClassName);

    // Method 0: Class instance constructor (iinit)
    const iinitMethodIdx = builder.addMethod(`${className}$cinit`, [], 0, 0);

    // Method 1: Class static constructor (cinit)
    const cinitMethodIdx = builder.addMethod(`${className}$sinit`, [], 0, 0);

    // Method 2: Script entry point
    const scriptInitMethodIdx = builder.addMethod('script$init', [], 0, 0);

    // Add Class
    const classIdx = builder.addClass(
      {
        name: classQName,
        superName: superQName,
        flags: 0x00,
        interfaces: [],
        iinit: iinitMethodIdx,
        traits: []
      },
      {
        cinit: cinitMethodIdx,
        traits: []
      }
    );

    // Add Script
    builder.addScript(scriptInitMethodIdx, [
      {
        name: classQName,
        kind: 0x04, // Trait_Class
        slotId: 1,
        classi: classIdx
      }
    ]);

    // Build Bytecode for iinit (Constructor)
    const iinitCode = [];
    iinitCode.push(AVM2_OPS.getlocal_0);
    iinitCode.push(AVM2_OPS.pushscope);
    iinitCode.push(AVM2_OPS.getlocal_0);
    iinitCode.push(AVM2_OPS.constructsuper);
    iinitCode.push(0); // 0 arguments

    // Compile class constructor body statements if any
    if (classDecl) {
      for (const m of classDecl.members) {
        if (m.type === 'FunctionDeclaration' && m.name === className) {
          As3Compiler.compileStatements(m.body, iinitCode, builder, pkgNs);
        }
      }
    }

    iinitCode.push(AVM2_OPS.returnvoid);
    builder.addMethodBody(iinitMethodIdx, 8, 2, 1, 2, new Uint8Array(iinitCode));

    // Build Bytecode for cinit (Static Init)
    const cinitCode = [];
    cinitCode.push(AVM2_OPS.getlocal_0);
    cinitCode.push(AVM2_OPS.pushscope);
    cinitCode.push(AVM2_OPS.returnvoid);
    builder.addMethodBody(cinitMethodIdx, 2, 1, 1, 2, new Uint8Array(cinitCode));

    // Build Bytecode for Script Init (Top-level script / Frame action)
    const scriptCode = [];
    scriptCode.push(AVM2_OPS.getlocal_0);
    scriptCode.push(AVM2_OPS.pushscope);

    // Class setup in script
    scriptCode.push(AVM2_OPS.findpropstrict);
    writeU30Array(scriptCode, superQName);
    scriptCode.push(AVM2_OPS.getproperty);
    writeU30Array(scriptCode, superQName);
    scriptCode.push(AVM2_OPS.pushscope);

    scriptCode.push(AVM2_OPS.findpropstrict);
    writeU30Array(scriptCode, classQName);
    scriptCode.push(AVM2_OPS.newclass);
    writeU30Array(scriptCode, classIdx);
    scriptCode.push(AVM2_OPS.popscope);
    scriptCode.push(AVM2_OPS.initproperty);
    writeU30Array(scriptCode, classQName);

    // If frame script statements exist, compile them
    if (statements.length > 0) {
      As3Compiler.compileStatements(statements, scriptCode, builder, pkgNs);
    }

    scriptCode.push(AVM2_OPS.returnvoid);
    builder.addMethodBody(scriptInitMethodIdx, 16, 4, 1, 3, new Uint8Array(scriptCode));

    return builder.toBuffer();
  }

  static compileStatements(statements, code, builder, pkgNs) {
    const locals = { this: 0 };
    let nextLocal = 1;

    for (const stmt of statements) {
      if (stmt.type === 'ExpressionStatement') {
        if (stmt.expression.type === 'CallExpression') {
          As3Compiler.compileCall(stmt.expression, code, builder, pkgNs, locals, true);
        } else {
          As3Compiler.compileExpression(stmt.expression, code, builder, pkgNs, locals);
          code.push(AVM2_OPS.pop);
        }
      } else if (stmt.type === 'VariableDeclaration') {
        const slot = nextLocal++;
        locals[stmt.name] = slot;
        if (stmt.init) {
          As3Compiler.compileExpression(stmt.init, code, builder, pkgNs, locals);
          if (slot <= 3) {
            code.push(AVM2_OPS[`setlocal_${slot}`]);
          } else {
            code.push(AVM2_OPS.setlocal);
            writeU30Array(code, slot);
          }
        }
      } else if (stmt.type === 'IfStatement') {
        As3Compiler.compileExpression(stmt.test, code, builder, pkgNs, locals);
        code.push(AVM2_OPS.iffalse);
        const iffalsePos = code.length;
        code.push(0, 0, 0); // placeholder s24

        As3Compiler.compileStatements([stmt.consequent], code, builder, pkgNs);

        if (stmt.alternate) {
          code.push(AVM2_OPS.jump);
          const jumpPos = code.length;
          code.push(0, 0, 0); // placeholder s24

          // Patch iffalse target
          const elseTarget = code.length - (iffalsePos + 3);
          patchS24(code, iffalsePos, elseTarget);

          As3Compiler.compileStatements([stmt.alternate], code, builder, pkgNs);

          // Patch jump target
          const endTarget = code.length - (jumpPos + 3);
          patchS24(code, jumpPos, endTarget);
        } else {
          const endTarget = code.length - (iffalsePos + 3);
          patchS24(code, iffalsePos, endTarget);
        }
      } else if (stmt.type === 'WhileStatement') {
        const loopStart = code.length;
        As3Compiler.compileExpression(stmt.test, code, builder, pkgNs, locals);
        code.push(AVM2_OPS.iffalse);
        const iffalsePos = code.length;
        code.push(0, 0, 0);

        As3Compiler.compileStatements([stmt.body], code, builder, pkgNs);

        code.push(AVM2_OPS.jump);
        const jumpPos = code.length;
        code.push(0, 0, 0);
        patchS24(code, jumpPos, loopStart - (jumpPos + 3));

        const loopEnd = code.length - (iffalsePos + 3);
        patchS24(code, iffalsePos, loopEnd);
      } else if (stmt.type === 'BlockStatement') {
        As3Compiler.compileStatements(stmt.body, code, builder, pkgNs);
      }
    }
  }

  static compileCall(expr, code, builder, pkgNs, locals, isVoid = false) {
    const argCount = expr.arguments.length;
    if (expr.callee.type === 'Identifier') {
      const fnName = expr.callee.name;
      const qname = builder.addQName(pkgNs, fnName);
      code.push(AVM2_OPS.findpropstrict);
      writeU30Array(code, qname);
      for (const arg of expr.arguments) {
        As3Compiler.compileExpression(arg, code, builder, pkgNs, locals);
      }
      code.push(isVoid ? AVM2_OPS.callpropvoid : AVM2_OPS.callproperty);
      writeU30Array(code, qname);
      writeU30Array(code, argCount);
    } else if (expr.callee.type === 'MemberExpression') {
      As3Compiler.compileExpression(expr.callee.object, code, builder, pkgNs, locals);
      const propName = expr.callee.property.name;
      const qname = builder.addQName(pkgNs, propName);
      for (const arg of expr.arguments) {
        As3Compiler.compileExpression(arg, code, builder, pkgNs, locals);
      }
      code.push(isVoid ? AVM2_OPS.callpropvoid : AVM2_OPS.callproperty);
      writeU30Array(code, qname);
      writeU30Array(code, argCount);
    }
  }

  static compileExpression(expr, code, builder, pkgNs, locals) {
    if (!expr) return;

    if (expr.type === 'Literal') {
      if (typeof expr.value === 'number') {
        if (Number.isInteger(expr.value) && expr.value >= -128 && expr.value <= 127) {
          code.push(AVM2_OPS.pushbyte);
          code.push(expr.value & 0xFF);
        } else if (Number.isInteger(expr.value) && expr.value >= -32768 && expr.value <= 32767) {
          code.push(AVM2_OPS.pushshort);
          code.push(expr.value & 0xFF);
          code.push((expr.value >> 8) & 0xFF);
        } else {
          const dIdx = builder.addDouble(expr.value);
          code.push(AVM2_OPS.pushdouble);
          writeU30Array(code, dIdx);
        }
      } else if (typeof expr.value === 'string') {
        const sIdx = builder.addString(expr.value);
        code.push(AVM2_OPS.pushstring);
        writeU30Array(code, sIdx);
      } else if (expr.value === true) {
        code.push(AVM2_OPS.pushtrue);
      } else if (expr.value === false) {
        code.push(AVM2_OPS.pushfalse);
      } else if (expr.value === null) {
        code.push(AVM2_OPS.pushnull);
      }
    } else if (expr.type === 'Identifier') {
      if (locals[expr.name] !== undefined) {
        const slot = locals[expr.name];
        if (slot <= 3) code.push(AVM2_OPS[`getlocal_${slot}`]);
        else {
          code.push(AVM2_OPS.getlocal);
          writeU30Array(code, slot);
        }
      } else {
        const qname = builder.addQName(pkgNs, expr.name);
        code.push(AVM2_OPS.findpropstrict);
        writeU30Array(code, qname);
        code.push(AVM2_OPS.getproperty);
        writeU30Array(code, qname);
      }
    } else if (expr.type === 'CallExpression') {
      As3Compiler.compileCall(expr, code, builder, pkgNs, locals, false);
    } else if (expr.type === 'BinaryExpression') {
      As3Compiler.compileExpression(expr.left, code, builder, pkgNs, locals);
      As3Compiler.compileExpression(expr.right, code, builder, pkgNs, locals);
      if (expr.operator === '+') code.push(AVM2_OPS.add);
      else if (expr.operator === '-') code.push(AVM2_OPS.subtract);
      else if (expr.operator === '*') code.push(AVM2_OPS.multiply);
      else if (expr.operator === '/') code.push(AVM2_OPS.divide);
      else if (expr.operator === '%') code.push(AVM2_OPS.modulo);
      else if (expr.operator === '==') code.push(AVM2_OPS.equals);
      else if (expr.operator === '<') code.push(AVM2_OPS.lessthan);
      else if (expr.operator === '<=') code.push(AVM2_OPS.lessequals);
      else if (expr.operator === '>') code.push(AVM2_OPS.greaterthan);
      else if (expr.operator === '>=') code.push(AVM2_OPS.greaterequals);
    } else if (expr.type === 'AssignmentExpression') {
      if (expr.left.type === 'Identifier') {
        const varName = expr.left.name;
        if (expr.operator === '+=') {
          As3Compiler.compileExpression(expr.left, code, builder, pkgNs, locals);
          As3Compiler.compileExpression(expr.right, code, builder, pkgNs, locals);
          code.push(AVM2_OPS.add);
        } else if (expr.operator === '-=') {
          As3Compiler.compileExpression(expr.left, code, builder, pkgNs, locals);
          As3Compiler.compileExpression(expr.right, code, builder, pkgNs, locals);
          code.push(AVM2_OPS.subtract);
        } else if (expr.operator === '*=') {
          As3Compiler.compileExpression(expr.left, code, builder, pkgNs, locals);
          As3Compiler.compileExpression(expr.right, code, builder, pkgNs, locals);
          code.push(AVM2_OPS.multiply);
        } else if (expr.operator === '/=') {
          As3Compiler.compileExpression(expr.left, code, builder, pkgNs, locals);
          As3Compiler.compileExpression(expr.right, code, builder, pkgNs, locals);
          code.push(AVM2_OPS.divide);
        } else {
          As3Compiler.compileExpression(expr.right, code, builder, pkgNs, locals);
        }

        if (locals[varName] !== undefined) {
          const slot = locals[varName];
          code.push(AVM2_OPS.dup);
          if (slot <= 3) code.push(AVM2_OPS[`setlocal_${slot}`]);
          else {
            code.push(AVM2_OPS.setlocal);
            writeU30Array(code, slot);
          }
        } else {
          const qname = builder.addQName(pkgNs, varName);
          code.push(AVM2_OPS.findproperty);
          writeU30Array(code, qname);
          code.push(AVM2_OPS.swap);
          code.push(AVM2_OPS.setproperty);
          writeU30Array(code, qname);
        }
      }
    }
  }
}

function writeU30Array(arr, val) {
  val = val >>> 0;
  while (val > 0x7F) {
    arr.push((val & 0x7F) | 0x80);
    val >>>= 7;
  }
  arr.push(val & 0x7F);
}

function patchS24(code, pos, val) {
  code[pos] = val & 0xFF;
  code[pos + 1] = (val >> 8) & 0xFF;
  code[pos + 2] = (val >> 16) & 0xFF;
}

// --- AVM2 ABC Disassembler ---
class As3Disassembler {
  static disassemble(buffer) {
    const reader = new ByteReader(buffer);
    const minor = reader.readU16();
    const major = reader.readU16();

    const cpool = {
      integers: [0],
      uintegers: [0],
      doubles: [NaN],
      strings: ['*'],
      namespaces: [{ kind: 0, name: '*' }],
      nsSets: [[]],
      multinames: [{ kind: 0, name: '*' }]
    };

    // Constant Pool
    // Integers
    const intCount = reader.readU30();
    for (let i = 1; i < intCount; i++) cpool.integers.push(reader.readU30());

    // Uintegers
    const uintCount = reader.readU30();
    for (let i = 1; i < uintCount; i++) cpool.uintegers.push(reader.readU30());

    // Doubles
    const doubleCount = reader.readU30();
    for (let i = 1; i < doubleCount; i++) cpool.doubles.push(reader.readDouble());

    // Strings
    const stringCount = reader.readU30();
    for (let i = 1; i < stringCount; i++) {
      const len = reader.readU30();
      cpool.strings.push(reader.readUTF(len));
    }

    // Namespaces
    const nsCount = reader.readU30();
    for (let i = 1; i < nsCount; i++) {
      const kind = reader.readU8();
      const name = reader.readU30();
      cpool.namespaces.push({ kind, name: cpool.strings[name] || '' });
    }

    // NsSets
    const nsSetCount = reader.readU30();
    for (let i = 1; i < nsSetCount; i++) {
      const count = reader.readU30();
      const set = [];
      for (let j = 0; j < count; j++) set.push(reader.readU30());
      cpool.nsSets.push(set);
    }

    // Multinames
    const mnCount = reader.readU30();
    for (let i = 1; i < mnCount; i++) {
      const kind = reader.readU8();
      if (kind === 0x07 || kind === 0x0D) {
        const ns = reader.readU30();
        const name = reader.readU30();
        cpool.multinames.push({ kind, name: cpool.strings[name] || '*' });
      } else if (kind === 0x09 || kind === 0x0E) {
        const name = reader.readU30();
        const nsSet = reader.readU30();
        cpool.multinames.push({ kind, name: cpool.strings[name] || '*' });
      } else if (kind === 0x1B || kind === 0x1C) {
        const nsSet = reader.readU30();
        cpool.multinames.push({ kind, name: 'Late' });
      }
    }

    // Method Infos
    const methodCount = reader.readU30();
    const methods = [];
    for (let i = 0; i < methodCount; i++) {
      const paramCount = reader.readU30();
      const returnType = reader.readU30();
      const paramTypes = [];
      for (let j = 0; j < paramCount; j++) paramTypes.push(reader.readU30());
      const name = reader.readU30();
      const flags = reader.readU8();
      methods.push({
        id: i,
        name: cpool.strings[name] || `method_${i}`,
        paramCount,
        returnType: cpool.multinames[returnType]?.name || '*'
      });
    }

    // Metadata
    const metadataCount = reader.readU30();
    for (let i = 0; i < metadataCount; i++) {
      reader.readU30(); reader.readU30();
    }

    // Classes & Instances
    const classCount = reader.readU30();
    for (let i = 0; i < classCount; i++) {
      reader.readU30(); reader.readU30();
      const flags = reader.readU8();
      if (flags & 0x08) reader.readU30();
      const ifaceCount = reader.readU30();
      for (let j = 0; j < ifaceCount; j++) reader.readU30();
      reader.readU30(); // iinit
      const traitCount = reader.readU30();
      for (let j = 0; j < traitCount; j++) skipTrait(reader);
    }
    for (let i = 0; i < classCount; i++) {
      reader.readU30(); // cinit
      const traitCount = reader.readU30();
      for (let j = 0; j < traitCount; j++) skipTrait(reader);
    }

    // Scripts
    const scriptCount = reader.readU30();
    for (let i = 0; i < scriptCount; i++) {
      reader.readU30(); // init
      const traitCount = reader.readU30();
      for (let j = 0; j < traitCount; j++) skipTrait(reader);
    }

    // Method Bodies
    const methodBodyCount = reader.readU30();
    const disassembledMethods = [];

    for (let i = 0; i < methodBodyCount; i++) {
      const methodIdx = reader.readU30();
      const maxStack = reader.readU30();
      const localCount = reader.readU30();
      const initScope = reader.readU30();
      const maxScope = reader.readU30();
      const codeLen = reader.readU30();
      const codeBytes = reader.readBytes(codeLen);
      reader.readU30(); // exception_count
      reader.readU30(); // trait_count

      const instructions = [];
      const codeReader = new ByteReader(codeBytes);
      while (codeReader.pos < codeBytes.length) {
        const offset = codeReader.pos;
        const op = codeReader.readU8();
        const opName = AVM2_NAMES[op] || `0x${op.toString(16)}`;

        let operandStr = '';
        if (op === AVM2_OPS.findpropstrict || op === AVM2_OPS.findproperty ||
            op === AVM2_OPS.getproperty || op === AVM2_OPS.setproperty ||
            op === AVM2_OPS.initproperty) {
          const mnIdx = codeReader.readU30();
          operandStr = cpool.multinames[mnIdx]?.name || `mn[${mnIdx}]`;
        } else if (op === AVM2_OPS.callproperty || op === AVM2_OPS.callpropvoid || op === AVM2_OPS.constructprop) {
          const mnIdx = codeReader.readU30();
          const argc = codeReader.readU30();
          operandStr = `${cpool.multinames[mnIdx]?.name || `mn[${mnIdx}]`} (${argc})`;
        } else if (op === AVM2_OPS.pushstring) {
          const sIdx = codeReader.readU30();
          operandStr = `"${cpool.strings[sIdx] || ''}"`;
        } else if (op === AVM2_OPS.pushint) {
          const iIdx = codeReader.readU30();
          operandStr = `${cpool.integers[iIdx] || 0}`;
        } else if (op === AVM2_OPS.pushdouble) {
          const dIdx = codeReader.readU30();
          operandStr = `${cpool.doubles[dIdx] || 0}`;
        } else if (op === AVM2_OPS.pushbyte) {
          operandStr = `${codeReader.readU8()}`;
        } else if (op === AVM2_OPS.pushshort) {
          operandStr = `${codeReader.readU16()}`;
        } else if (op === AVM2_OPS.constructsuper || op === AVM2_OPS.construct) {
          operandStr = `args:${codeReader.readU30()}`;
        } else if (op === AVM2_OPS.newclass) {
          operandStr = `class:${codeReader.readU30()}`;
        } else if (op === AVM2_OPS.getlocal || op === AVM2_OPS.setlocal) {
          operandStr = `r${codeReader.readU30()}`;
        } else if (op === AVM2_OPS.jump || op === AVM2_OPS.iftrue || op === AVM2_OPS.iffalse ||
                   op === AVM2_OPS.ifeq || op === AVM2_OPS.ifne || op === AVM2_OPS.iflt ||
                   op === AVM2_OPS.ifle || op === AVM2_OPS.ifgt || op === AVM2_OPS.ifge) {
          const target = codeReader.readS24();
          operandStr = `offset:${target} -> ${offset + 4 + target}`;
        }

        instructions.push(`${offset.toString().padStart(4, ' ')}: ${opName.padEnd(16, ' ')} ${operandStr}`.trimEnd());
      }

      disassembledMethods.push({
        methodIndex: methodIdx,
        methodName: methods[methodIdx]?.name || `method_${methodIdx}`,
        maxStack,
        localCount,
        instructions
      });
    }

    let fullText = `// AVM2 Bytecode Disassembly (SWF v19 DoABC Tag 82)\n// ABC Version: ${major}.${minor}\n\n`;
    for (const dm of disassembledMethods) {
      fullText += `--- Method: ${dm.methodName} (stack: ${dm.maxStack}, locals: ${dm.localCount}) ---\n`;
      for (const line of dm.instructions) {
        fullText += `  ${line}\n`;
      }
      fullText += '\n';
    }

    return {
      version: `${major}.${minor}`,
      constants: cpool,
      methods: disassembledMethods,
      fullText
    };
  }
}

function skipTrait(reader) {
  reader.readU30(); // name
  const kind = reader.readU8();
  const type = kind & 0x0F;
  if (type === 0 || type === 6) {
    reader.readU30(); reader.readU30();
    const vindex = reader.readU30();
    if (vindex) reader.readU8();
  } else if (type === 1 || type === 2 || type === 3) {
    reader.readU30(); reader.readU30();
  } else if (type === 4 || type === 5) {
    reader.readU30(); reader.readU30();
  }
}

// --- ActionScript 3 Standard Library & Flash Display API ---

class EventDispatcher {
  constructor() {
    this._listeners = {};
  }

  addEventListener(type, listener) {
    if (!this._listeners[type]) this._listeners[type] = [];
    if (!this._listeners[type].includes(listener)) {
      this._listeners[type].push(listener);
    }
  }

  removeEventListener(type, listener) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(l => l !== listener);
  }

  hasEventListener(type) {
    return !!(this._listeners[type] && this._listeners[type].length > 0);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    const list = this._listeners[event.type];
    if (list) {
      for (const l of [...list]) {
        try { l(event); } catch (e) { console.error('AS3 event listener error:', e); }
      }
    }
    return true;
  }
}

class Event {
  static ENTER_FRAME = 'enterFrame';
  static ADDED = 'added';
  static REMOVED = 'removed';
  static ADDED_TO_STAGE = 'addedToStage';
  static REMOVED_FROM_STAGE = 'removedFromStage';
  static CHANGE = 'change';
  static COMPLETE = 'complete';

  constructor(type, bubbles = false, cancelable = false) {
    this.type = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
    this.target = null;
    this.currentTarget = null;
  }
}

class MouseEvent extends Event {
  static CLICK = 'click';
  static MOUSE_DOWN = 'mouseDown';
  static MOUSE_UP = 'mouseUp';
  static MOUSE_MOVE = 'mouseMove';
  static MOUSE_OVER = 'mouseOver';
  static MOUSE_OUT = 'mouseOut';

  constructor(type, bubbles = true, cancelable = false, localX = 0, localY = 0) {
    super(type, bubbles, cancelable);
    this.localX = localX;
    this.localY = localY;
    this.stageX = localX;
    this.stageY = localY;
    this.buttonDown = false;
  }
}

class KeyboardEvent extends Event {
  static KEY_DOWN = 'keyDown';
  static KEY_UP = 'keyUp';

  constructor(type, bubbles = true, cancelable = false, charCode = 0, keyCode = 0) {
    super(type, bubbles, cancelable);
    this.charCode = charCode;
    this.keyCode = keyCode;
  }
}

class TimerEvent extends Event {
  static TIMER = 'timer';
  static TIMER_COMPLETE = 'timerComplete';

  constructor(type, bubbles = false, cancelable = false) {
    super(type, bubbles, cancelable);
  }
}

class DisplayObject extends EventDispatcher {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.alpha = 1;
    this.visible = true;
    this.name = 'instance' + Math.floor(Math.random() * 10000);
    this.parent = null;
    this.stage = null;
  }
}

class InteractiveObject extends DisplayObject {
  constructor() {
    super();
    this.mouseEnabled = true;
  }
}

class DisplayObjectContainer extends InteractiveObject {
  constructor() {
    super();
    this.children = [];
  }

  get numChildren() {
    return this.children.length;
  }

  addChild(child) {
    return this.addChildAt(child, this.children.length);
  }

  addChildAt(child, index) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    child.stage = this.stage;
    this.children.splice(index, 0, child);
    child.dispatchEvent(new Event(Event.ADDED));
    if (this.stage) child.dispatchEvent(new Event(Event.ADDED_TO_STAGE));
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) return this.removeChildAt(idx);
    return null;
  }

  removeChildAt(index) {
    const child = this.children.splice(index, 1)[0];
    if (child) {
      child.parent = null;
      child.stage = null;
      child.dispatchEvent(new Event(Event.REMOVED));
    }
    return child;
  }

  getChildAt(index) {
    return this.children[index] || null;
  }

  getChildByName(name) {
    return this.children.find(c => c.name === name) || null;
  }

  contains(child) {
    return this.children.includes(child);
  }
}

class Graphics {
  constructor(target) {
    this.target = target;
    this.commands = [];
  }

  beginFill(color = 0x000000, alpha = 1.0) {
    this.commands.push({ type: 'beginFill', color, alpha });
  }

  endFill() {
    this.commands.push({ type: 'endFill' });
  }

  lineStyle(width = 0, color = 0x000000, alpha = 1.0) {
    this.commands.push({ type: 'lineStyle', width, color, alpha });
  }

  drawRect(x, y, width, height) {
    this.commands.push({ type: 'drawRect', x, y, width, height });
    if (this.target) {
      this.target.width = Math.max(this.target.width, width);
      this.target.height = Math.max(this.target.height, height);
    }
  }

  drawCircle(x, y, radius) {
    this.commands.push({ type: 'drawCircle', x, y, radius });
  }

  drawRoundRect(x, y, width, height, ellipseWidth, ellipseHeight) {
    this.commands.push({ type: 'drawRoundRect', x, y, width, height, ellipseWidth, ellipseHeight });
  }

  moveTo(x, y) {
    this.commands.push({ type: 'moveTo', x, y });
  }

  lineTo(x, y) {
    this.commands.push({ type: 'lineTo', x, y });
  }

  clear() {
    this.commands = [];
  }
}

class Sprite extends DisplayObjectContainer {
  constructor() {
    super();
    this.graphics = new Graphics(this);
  }
}

class MovieClip extends Sprite {
  constructor(totalFrames = 1) {
    super();
    this._currentFrame = 1;
    this.totalFrames = totalFrames;
    this.isPlaying = true;
    this.framesLoaded = totalFrames;
  }

  get currentFrame() {
    return this._currentFrame;
  }

  stop() {
    this.isPlaying = false;
  }

  play() {
    this.isPlaying = true;
  }

  gotoAndStop(frame) {
    this._currentFrame = Math.max(1, Math.min(this.totalFrames, Number(frame)));
    this.isPlaying = false;
  }

  gotoAndPlay(frame) {
    this._currentFrame = Math.max(1, Math.min(this.totalFrames, Number(frame)));
    this.isPlaying = true;
  }

  nextFrame() {
    if (this._currentFrame < this.totalFrames) this._currentFrame++;
  }

  prevFrame() {
    if (this._currentFrame > 1) this._currentFrame--;
  }
}

class Stage extends DisplayObjectContainer {
  constructor(width = 800, height = 600, fps = 24) {
    super();
    this.stage = this;
    this.stageWidth = width;
    this.stageHeight = height;
    this.frameRate = fps;
    this.color = 0xFFFFFF;
  }
}

class TextField extends InteractiveObject {
  constructor() {
    super();
    this.text = '';
    this.textColor = 0x000000;
    this.selectable = true;
    this.border = false;
    this.borderColor = 0x000000;
    this.autoSize = 'none';
  }
}

class Point {
  constructor(x = 0, y = 0) {
    this.x = Number(x);
    this.y = Number(y);
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  add(v) {
    return new Point(this.x + v.x, this.y + v.y);
  }

  subtract(v) {
    return new Point(this.x - v.x, this.y - v.y);
  }

  equals(toCompare) {
    return this.x === toCompare.x && this.y === toCompare.y;
  }

  clone() {
    return new Point(this.x, this.y);
  }

  static distance(pt1, pt2) {
    const dx = pt2.x - pt1.x;
    const dy = pt2.y - pt1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static polar(len, angle) {
    return new Point(len * Math.cos(angle), len * Math.sin(angle));
  }
}

class Rectangle {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = Number(x);
    this.y = Number(y);
    this.width = Number(width);
    this.height = Number(height);
  }

  get left() { return this.x; }
  get right() { return this.x + this.width; }
  get top() { return this.y; }
  get bottom() { return this.y + this.height; }

  contains(x, y) {
    return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
  }

  containsPoint(point) {
    return this.contains(point.x, point.y);
  }

  intersects(toIntersect) {
    return !(toIntersect.left > this.right ||
             toIntersect.right < this.left ||
             toIntersect.top > this.bottom ||
             toIntersect.bottom < this.top);
  }

  union(toUnion) {
    const minX = Math.min(this.left, toUnion.left);
    const minY = Math.min(this.top, toUnion.top);
    const maxX = Math.max(this.right, toUnion.right);
    const maxY = Math.max(this.bottom, toUnion.bottom);
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  clone() {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }
}

class ByteArray {
  constructor() {
    this.buffer = new Uint8Array(1024);
    this._length = 0;
    this.position = 0;
  }

  get length() { return this._length; }
  set length(val) { this._length = val; }
  get bytesAvailable() { return Math.max(0, this._length - this.position); }

  ensureCapacity(extra) {
    if (this.position + extra > this.buffer.length) {
      const newBuf = new Uint8Array(Math.max(this.buffer.length * 2, this.buffer.length + extra + 1024));
      newBuf.set(this.buffer.subarray(0, this._length));
      this.buffer = newBuf;
    }
  }

  writeByte(val) {
    this.ensureCapacity(1);
    this.buffer[this.position++] = val & 0xFF;
    this._length = Math.max(this._length, this.position);
  }

  readByte() {
    return this.buffer[this.position++];
  }

  writeInt(val) {
    this.ensureCapacity(4);
    const view = new DataView(this.buffer.buffer, this.position, 4);
    view.setInt32(0, val, false); // AS3 ByteArray default is Big-Endian network order
    this.position += 4;
    this._length = Math.max(this._length, this.position);
  }

  readInt() {
    const view = new DataView(this.buffer.buffer, this.position, 4);
    this.position += 4;
    return view.getInt32(0, false);
  }

  writeUTF(str) {
    const utf8 = (typeof Buffer !== 'undefined') ? Buffer.from(str, 'utf8') : new TextEncoder().encode(str);
    this.ensureCapacity(2 + utf8.length);
    const view = new DataView(this.buffer.buffer, this.position, 2);
    view.setUint16(0, utf8.length, false);
    this.position += 2;
    this.buffer.set(utf8, this.position);
    this.position += utf8.length;
    this._length = Math.max(this._length, this.position);
  }

  readUTF() {
    const view = new DataView(this.buffer.buffer, this.position, 2);
    const len = view.getUint16(0, false);
    this.position += 2;
    const slice = this.buffer.subarray(this.position, this.position + len);
    this.position += len;
    return (typeof Buffer !== 'undefined') ? Buffer.from(slice).toString('utf8') : new TextDecoder().decode(slice);
  }

  clear() {
    this._length = 0;
    this.position = 0;
  }
}

class Timer extends EventDispatcher {
  constructor(delay = 1000, repeatCount = 0) {
    super();
    this.delay = delay;
    this.repeatCount = repeatCount;
    this.currentCount = 0;
    this.running = false;
    this._timerId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._timerId = setInterval(() => {
      this.currentCount++;
      this.dispatchEvent(new TimerEvent(TimerEvent.TIMER));
      if (this.repeatCount > 0 && this.currentCount >= this.repeatCount) {
        this.stop();
        this.dispatchEvent(new TimerEvent(TimerEvent.TIMER_COMPLETE));
      }
    }, this.delay);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._timerId);
  }

  reset() {
    this.stop();
    this.currentCount = 0;
  }
}

// Convert AST nodes to executable JavaScript for sandboxed evaluation
function astToJs(node) {
  if (!node) return '';
  switch (node.type) {
    case 'Program':
    case 'PackageDeclaration':
      return node.body.map(astToJs).filter(Boolean).join('\n');
    case 'ImportDeclaration':
      return '';
    case 'ClassDeclaration': {
      let ctorBody = '';
      const methods = [];
      for (const m of node.members) {
        if (m.type === 'FunctionDeclaration' && m.name === node.name) {
          ctorBody = m.body.map(astToJs).join('\n');
        } else if (m.type === 'FunctionDeclaration') {
          methods.push(m.name + '(' + m.params.map(p => p.name).join(', ') + ') {\n' + m.body.map(astToJs).join('\n') + '\n}');
        } else {
          methods.push(astToJs(m));
        }
      }
      return `class ${node.name} extends ${node.superName || 'MovieClip'} {
        constructor() {
          super();
          ${ctorBody}
        }
        ${methods.join('\n')}
      }
      var __docInstance = new ${node.name}();
      `;
    }
    case 'VariableDeclaration':
      return `${node.isConst ? 'const' : 'var'} ${node.name} ${node.init ? '= ' + astToJs(node.init) : ''};`;
    case 'FunctionDeclaration':
      return `function ${node.name}(${node.params.map(p => p.name).join(', ')}) {\n${node.body.map(astToJs).join('\n')}\n}`;
    case 'FunctionExpression':
      return `function(${node.params.map(p => p.name).join(', ')}) {\n${node.body.map(astToJs).join('\n')}\n}`;
    case 'IfStatement':
      return `if (${astToJs(node.test)}) {\n${astToJs(node.consequent)}\n}` + (node.alternate ? ` else {\n${astToJs(node.alternate)}\n}` : '');
    case 'WhileStatement':
      return `while (${astToJs(node.test)}) {\n${astToJs(node.body)}\n}`;
    case 'ForStatement':
      return `for (${astToJs(node.init)} ${astToJs(node.test)}; ${astToJs(node.update)}) {\n${astToJs(node.body)}\n}`;
    case 'ReturnStatement':
      return `return ${node.argument ? astToJs(node.argument) : ''};`;
    case 'BlockStatement':
      return '{\n' + node.body.map(astToJs).join('\n') + '\n}';
    case 'ExpressionStatement':
      return astToJs(node.expression) + ';';
    case 'AssignmentExpression':
      return `${astToJs(node.left)} ${node.operator} ${astToJs(node.right)}`;
    case 'BinaryExpression':
      return `(${astToJs(node.left)} ${node.operator} ${astToJs(node.right)})`;
    case 'UnaryExpression':
      return `${node.operator}(${astToJs(node.argument)})`;
    case 'UpdateExpression':
      return `${astToJs(node.argument)}${node.operator}`;
    case 'CallExpression':
      return `${astToJs(node.callee)}(${node.arguments.map(astToJs).join(', ')})`;
    case 'MemberExpression':
      return `${astToJs(node.object)}${node.computed ? '[' + astToJs(node.property) + ']' : '.' + node.property.name}`;
    case 'NewExpression':
      return `new ${node.callee.name}(${node.arguments.map(astToJs).join(', ')})`;
    case 'Literal':
      return JSON.stringify(node.value);
    case 'Identifier':
      return node.name;
    case 'ArrayExpression':
      return '[' + node.elements.map(astToJs).join(', ') + ']';
    case 'ObjectExpression':
      return '{' + node.properties.map(p => p.key + ': ' + astToJs(p.value)).join(', ') + '}';
    default:
      return '';
  }
}

// --- ActionScript 3 Execution Runtime Sandbox ---
class As3Runtime {
  constructor(options = {}) {
    this.stage = new Stage(options.width || 800, options.height || 600, options.fps || 24);
    this.root = new MovieClip(options.totalFrames || 60);
    this.stage.addChild(this.root);

    this.traces = [];
    this.onTrace = options.onTrace || null;
    this.startTime = Date.now();
  }

  getTimer() {
    return Date.now() - this.startTime;
  }

  trace(...args) {
    const formatted = args.map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ');
    this.traces.push(formatted);
    if (this.onTrace) this.onTrace(formatted);
  }

  checkSyntax(code) {
    try {
      const tokenizer = new As3Tokenizer(code);
      const tokens = tokenizer.tokenize();
      const parser = new As3Parser(tokens);
      parser.parseProgram();
      return {
        valid: true,
        errorCount: 0,
        warningCount: 0,
        message: 'ActionScript 3.0 syntax check passed: 0 errors, 0 warnings.'
      };
    } catch (err) {
      return {
        valid: false,
        errorCount: 1,
        warningCount: 0,
        message: err.message
      };
    }
  }

  execute(code, clipContext = null) {
    const targetClip = clipContext || this.root;

    // Build execution sandbox with AS3 Flash standard library
    const sandbox = {
      trace: (...args) => this.trace(...args),
      stop: () => targetClip.stop(),
      play: () => targetClip.play(),
      gotoAndStop: (f) => targetClip.gotoAndStop(f),
      gotoAndPlay: (f) => targetClip.gotoAndPlay(f),
      nextFrame: () => targetClip.nextFrame(),
      prevFrame: () => targetClip.prevFrame(),
      currentFrame: targetClip.currentFrame,
      totalFrames: targetClip.totalFrames,
      addChild: (c) => targetClip.addChild(c),
      removeChild: (c) => targetClip.removeChild(c),
      stage: this.stage,
      root: this.root,

      // Display & Event Classes
      MovieClip,
      Sprite,
      Graphics,
      DisplayObject,
      DisplayObjectContainer,
      Stage,
      TextField,
      Point,
      Rectangle,
      ByteArray,
      Timer,
      Event,
      MouseEvent,
      KeyboardEvent,
      TimerEvent,
      EventDispatcher,

      // Utility
      getTimer: () => this.getTimer(),
      int: (v) => Math.trunc(Number(v) || 0),
      uint: (v) => (Number(v) || 0) >>> 0,
      Number: (v) => Number(v),
      String: (v) => String(v),
      Boolean: (v) => Boolean(v),
      Math: Math,
      Date: Date,
      Array: Array,
      Object: Object
    };

    const tokenizer = new As3Tokenizer(code);
    const tokens = tokenizer.tokenize();
    const parser = new As3Parser(tokens);
    const ast = parser.parseProgram();
    const jsCode = astToJs(ast);

    // Run within function bound to targetClip
    const argNames = Object.keys(sandbox);
    const argVals = Object.values(sandbox);
    const fn = new Function(...argNames, `with(this) {\n${jsCode}\n}`);
    return fn.apply(targetClip, argVals);
  }
}

// Module export for Node.js CommonJS & Browser Global
const As3Engine = {
  AVM2_OPS,
  AVM2_NAMES,
  ByteWriter,
  ByteReader,
  AbcFileBuilder,
  As3Tokenizer,
  As3Parser,
  As3Compiler,
  As3Disassembler,
  EventDispatcher,
  Event,
  MouseEvent,
  KeyboardEvent,
  TimerEvent,
  DisplayObject,
  InteractiveObject,
  DisplayObjectContainer,
  Graphics,
  Sprite,
  MovieClip,
  Stage,
  TextField,
  Point,
  Rectangle,
  ByteArray,
  Timer,
  As3Runtime
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = As3Engine;
}
if (typeof window !== 'undefined') {
  window.As3Engine = As3Engine;
}
