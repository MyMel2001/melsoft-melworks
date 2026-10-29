// MelEditor - UMD VSCode-class editor core (Node module.exports + window.MelEditor)
(function (root, factory) {
  const api = factory();
  root.MelEditor = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const AUTO_CLOSE = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

  const LANG_BY_EXT = {
    html: 'html', htm: 'html', css: 'css', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown', markdown: 'markdown', py: 'python', python: 'python',
    go: 'go', golang: 'go'
  };

  const EXTRA_LANGS = { c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', rs: 'rust', java: 'java', php: 'php', rb: 'ruby', sh: 'shell', sql: 'sql', yaml: 'yaml', yml: 'yaml', txt: 'text' };

  function detectLanguageFromContent(text) {
    const t = String(text || '');
    const s = t.trim();
    if (/^<!doctype|<html[\s>]/i.test(s)) return 'html';
    if (/^(#{1,6}\s|```|[-*+] |\d+\.\s)/m.test(s)) return 'markdown';
    if (/[;#]\s*(font|margin|padding|display|position|background|color|border|width|height)[\s:]/m.test(s)) return 'css';
    if (/^(import\s|export\s|const\s|let\s|var\s|function\s|class\s|def\s|package\s|fn\s|impl\s|using\s|<\?php|from\s)/m.test(s)) return 'javascript';
    if (/^(BEGIN|END|CREATE|INSERT|SELECT|UPDATE|DELETE|ALTER|GRANT|PRAGMA)\b/m.test(s)) return 'sql';
    if (/^(package\s|module\s|use\s|go\()/m.test(s)) return 'go';
    if (/^(import\s+.*\nfrom\s|package\s+.*\nimport\s)/m.test(s)) return 'python';
    if (/^(module\s|use\s+strict|pub\s+fn|fn\s+)/m.test(s)) return 'rust';
    return 'text';
  }

  function detectLanguage(fileName) {
    const name = String(fileName || '');
    const idx = name.lastIndexOf('.');
    if (idx < 0) return 'text';
    const ext = name.slice(idx + 1).toLowerCase();
    if (['html', 'htm', 'css', 'js', 'mjs', 'cjs', 'jsx', 'json', 'md', 'markdown', 'py', 'python', 'go', 'golang', 'ts', 'tsx', 'mts', 'cts', 'coffee', 'elm', 'ex', 'erl', 'fs', 'hs', 'kt', 'lua', 'm', 'nim', 'pl', 'pm', 'r', 'scala', 'swift', 'tcl', 'v'].indexOf(ext) >= 0) {
      return { html: 'html', htm: 'html', css: 'css', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', json: 'json', md: 'markdown', markdown: 'markdown', py: 'python', python: 'python', go: 'go', golang: 'go', ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript', coffee: 'coffee', elm: 'elm', ex: 'elixir', erl: 'erlang', fs: 'fsharp', hs: 'haskell', kt: 'kotlin', lua: 'lua', m: 'matlab', nim: 'nim', pl: 'perl', pm: 'perl', r: 'r', scala: 'scala', swift: 'swift', tcl: 'tcl', v: 'v' }[ext] || 'text';
    }
    if (EXTRA_LANGS[ext]) return EXTRA_LANGS[ext];
    if (ext === 'ts') return 'typescript';
    if (ext === 'tsx') return 'typescript';
    if (ext === 'mts') return 'typescript';
    if (ext === 'cts') return 'typescript';
    if (ext === 'txt') return 'text';
    return 'text';
  }

  class EditorDoc {
    constructor(text, language) {
      this.text = String(text == null ? '' : text);
      this.language = language || detectLanguageFromContent(this.text);
      this.undoStack = [{ text: this.text }];
      this.redoStack = [];
      this.maxUndo = 200;
    }
    getText() { return this.text; }
    setText(t) { this.pushUndo('setText'); this.text = String(t == null ? '' : t); return this.text; }
    getLine(line) {
      const lines = this.text.split('\n');
      const idx = (line || 1) - 1;
      if (idx < 0 || idx >= lines.length) return '';
      return lines[idx];
    }
    lineCount() { return this.text.split('\n').length; }
    insert(pos, text) { this.pushUndo('insert'); this.text = this.text.slice(0, pos) + String(text) + this.text.slice(pos); return this; }
    deleteRange(start, end) { this.pushUndo('delete'); this.text = this.text.slice(0, start) + this.text.slice(end); return this; }
    pushUndo(label) {
      this.undoStack.push({ text: this.text, label: label || 'edit' });
      if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
      this.redoStack = [];
      return this;
    }
    undo() {
      const prev = this.undoStack.pop();
      if (!prev) return false;
      this.redoStack.push({ text: this.text });
      this.text = prev.text;
      return true;
    }
    redo() {
      const next = this.redoStack.pop();
      if (!next) return false;
      this.undoStack.push({ text: this.text });
      this.text = next.text;
      return true;
    }
    positionToOffset(pos) {
      const lines = this.text.split('\n');
      const line = Math.min(Math.max(Number(pos && pos.line) || 1, 1), lines.length);
      const col = Math.min(Math.max(Number(pos && pos.column) || 1, 1), (lines[line - 1] || '').length + 1);
      let offset = 0;
      for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1;
      return offset + (col - 1);
    }
    offsetToPosition(offset) {
      const lines = this.text.split('\n');
      let line = 1;
      let remaining = Number(offset) || 0;
      while (line - 1 < lines.length && remaining > (lines[line - 1] || '').length) { remaining -= (lines[line - 1] || '').length + 1; line++; }
      return { line, column: remaining + 1 };
    }
  }

  function inIgnored(text, pos) {
    const s = String(text);
    let i = 0;
    while (i < pos) {
      const c = s[i];
      if (c === '/' && s[i + 1] === '/') return true;
      if (c === '/' && s[i + 1] === '*') {
        const e = s.indexOf('*/', i + 2);
        if (e === -1 || e > pos) return true;
        i = e + 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        const q = c;
        let j = i + 1;
        let closed = -1;
        while (j < s.length) {
          if (s[j] === '\\') { j += 2; continue; }
          if (s[j] === q) { closed = j; break; }
          j++;
        }
        if (closed === -1 || closed > pos) return true;
        i = closed + 1;
        continue;
      }
      i++;
    }
    return false;
  }

  function shouldAutoClose(text, pos, typed) {
    const close = AUTO_CLOSE[typed];
    if (!close) return false;
    const t = String(text);
    if (t.slice(pos, pos + 2) === close) return false;
    if (inIgnored(t, pos)) return false;
    const before = t.slice(0, pos);
    const prevChar = before.charAt(before.length - 1);
    const isQuote = typed === '"' || typed === "'" || typed === '`';
    if (isQuote) {
      if (prevChar && /[\w]/.test(prevChar)) return false;
    }
    return true;
  }

  function bracketPairs(text) {
    const s = String(text);
    const pairs = [];
    const unmatched = [];
    const openers = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    let mode = 'code';
    let quote = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (mode === 'line') { if (c === '\n') mode = 'code'; continue; }
      if (mode === 'block') { if (s.startsWith('*/', i)) { mode = 'code'; i++; } continue; }
      if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
      if (c === '/' && s[i + 1] === '/') { mode = 'line'; continue; }
      if (c === '/' && s[i + 1] === '*') { mode = 'block'; const e = s.indexOf('*/', i + 2); i = e === -1 ? s.length : e + 1; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      const isOpen = Object.prototype.hasOwnProperty.call(openers, c);
      const isClose = c === ')' || c === ']' || c === '}';
      if (isOpen) stack.push({ char: c, index: i });
      else if (isClose) {
        const top = stack[stack.length - 1];
        if (top) { pairs.push({ open: top.char, close: c, start: top.index, end: i }); stack.pop(); }
        else unmatched.push({ char: c, index: i, type: 'close' });
      }
    }
    for (const st of stack) unmatched.push({ char: st.char, index: st.index, type: 'open' });
    return { pairs, unmatched };
  }

  function tokenize(text, language) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    const state = { mode: 'code' };
    for (const line of lines) {
      const res = scanLine(language, line, state);
      out.push(res.tokens);
      state.mode = res.state.mode;
    }
    return out;
  }

  const JS_KEYWORDS = new Set(['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','import','from','export','default','try','catch','finally','throw','async','await','yield','static','get','set','enum','implements','interface','package','private','protected','public']);

  function scanJsLine(line, state, toks, push) {
    const s = line;
    if (state.mode === 'blockComment') {
      const end = s.indexOf('*/');
      const val = end === -1 ? s : s.slice(0, end + 2);
      push('comment', val);
      state.mode = end === -1 ? 'blockComment' : 'code';
      return { tokens: toks, state };
    }
    if (state.mode === 'template') {
      let j = 0;
      let closed = -1;
      while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === '`') { closed = j; break; } j++; }
      const chunk = closed === -1 ? s : s.slice(0, closed + 1);
      push('string', chunk);
      const tailStart = closed === -1 ? s.length : closed + 1;
      state.mode = closed === -1 ? 'template' : 'code';
      if (tailStart < s.length) return scanJsLine(s.slice(tailStart), state, toks, push);
      return { tokens: toks, state };
    }
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '/' && s[i + 1] === '/') { push('comment', s.slice(i)); break; }
      if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); const val = e === -1 ? s.slice(i) : s.slice(i, e + 2); push('comment', val); state.mode = e === -1 ? 'blockComment' : 'code'; if (e === -1) break; i = e + 2; continue; }
      if (c === '"' || c === "'" || c === '`') {
        const q = c;
        let j = i + 1;
        let closed = -1;
        while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === q) { closed = j; break; } j++; }
        const val = closed === -1 ? s.slice(i) : s.slice(i, closed + 1);
        push('string', val);
        state.mode = closed === -1 ? 'template' : 'code';
        i = closed === -1 ? s.length : closed + 1;
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        const m2 = /^0[xX][0-9a-fA-F]+|^[0-9][0-9_]*(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(s.slice(i));
        const val = m2 ? m2[0] : c;
        push('number', val);
        i += val.length;
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        const m2 = /^[A-Za-z_$][\w$]*/.exec(s.slice(i));
        const val = m2 ? m2[0] : c;
        push(JS_KEYWORDS.has(val) ? 'keyword' : 'identifier', val);
        i += val.length;
        continue;
      }
      const two = s.slice(i, i + 2);
      if (['===','!==','==','=>','&&','||','??','++','--','+=','-=','*=','/=','%=','&&=','||='].indexOf(two) >= 0) { push('operator', two); i += 2; continue; }
      if ('+-*/%=<>!?:;,.()[]{}'.indexOf(c) >= 0) { push('punctuation', c); i++; continue; }
      i++;
    }
    return { tokens: toks, state };
  }

  function scanJsonLine(line, toks, push) {
    const s = line;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '"') {
        let j = i + 1;
        let closed = -1;
        while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === '"') { closed = j; break; } j++; }
        const val = closed === -1 ? s.slice(i) : s.slice(i, closed + 1);
        push('string', val);
        i = closed === -1 ? s.length : closed + 1;
        continue;
      }
      if (/[0-9-]/.test(c)) { const m2 = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(s.slice(i)); const val = m2 ? m2[0] : c; push('number', val); i += val.length; continue; }
      const m2 = /^[A-Za-z_]\w*/.exec(s.slice(i));
      if (m2) { const val = m2[0]; push(val === 'true' || val === 'false' || val === 'null' ? 'keyword' : 'property', val); i += val.length; continue; }
      if ('{}[]:,'.indexOf(c) >= 0) { push('punctuation', c); i++; continue; }
      i++;
    }
    return { tokens: toks, state: { mode: 'code' } };
  }

  const PY_KEYWORDS = new Set(['def','class','return','if','elif','else','for','while','in','not','and','or','is','None','True','False','import','from','as','with','try','except','finally','raise','pass','break','continue','global','lambda','nonlocal','assert','del','yield','async','await','match','case']);

  function scanPythonLine(line, state, toks, push) {
    const s = line;
    if (state.mode === 'triple') {
      const q = state.triple;
      if (s.indexOf(q) >= 0) { push('string', q + s + q); state.mode = 'code'; return { tokens: toks, state }; }
      push('string', s);
      return { tokens: toks, state };
    }
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') { push('comment', s.slice(i)); break; }
      if (c === '"' || c === "'") {
        const q = c;
        const tripleQ = q + q;
        const t = s.slice(i);
        if (t.slice(0, 3) === tripleQ) {
          const closeIdx = t.indexOf(tripleQ);
          const val = closeIdx === -1 ? t : t.slice(0, closeIdx + 3);
          push('string', val);
          state.mode = closeIdx === -1 ? 'triple' : 'code';
          i += val.length;
          continue;
        }
        let j = i + 1;
        let closed = -1;
        while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === q) { closed = j; break; } j++; }
        const val = closed === -1 ? s.slice(i) : s.slice(i, closed + 1);
        push('string', val);
        state.mode = closed === -1 ? 'string' : 'code';
        i = closed === -1 ? s.length : closed + 1;
        continue;
      }
      if (c === '@' && /^[A-Za-z_]/.test(s[i + 1] || '')) { const m2 = /^[A-Za-z_]\w*/.exec(s.slice(i + 1)); push('decorator', '@' + (m2 ? m2[0] : '')); i += 1 + (m2 ? m2[0].length : 0); continue; }
      if (/[0-9]/.test(c)) { const m2 = /^0[xX][0-9a-fA-F]+|^[0-9][0-9_]*(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(s.slice(i)); const val = m2 ? m2[0] : c; push('number', val); i += val.length; continue; }
      const m2 = /^[A-Za-z_]\w*/.exec(s.slice(i));
      if (m2) { const val = m2[0]; push(PY_KEYWORDS.has(val) ? 'keyword' : 'identifier', val); i += val.length; continue; }
      if (/[+\-*/%=<>!&|^~:@]+/.test(c)) { const m3 = /^[+\-*/%=<>!&|^~:@]+/.exec(s.slice(i)); const val = m3 ? m3[0] : c; push('operator', val); i += val.length; continue; }
      i++;
    }
    return { tokens: toks, state };
  }

  const GO_KEYWORDS = new Set(['package','import','func','type','struct','interface','map','chan','go','defer','return','if','else','for','range','switch','case','default','break','continue','select','var','const','nil','true','false','iota','make','new','len','cap','append','panic','recover','print','println']);

  function scanGoLine(line, state, toks, push) {
    const s = line;
    if (state.mode === 'commentBlock') { const e = s.indexOf('*/'); const val = e === -1 ? s : s.slice(0, e + 2); push('comment', val); state.mode = e === -1 ? 'commentBlock' : 'code'; return { tokens: toks, state }; }
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '/' && s[i + 1] === '/') { push('comment', s.slice(i)); break; }
      if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); const val = e === -1 ? s.slice(i) : s.slice(i, e + 2); push('comment', val); state.mode = e === -1 ? 'commentBlock' : 'code'; if (e === -1) break; i = e + 2; continue; }
      if (c === '`') { push('string', s.slice(i)); i = s.length; continue; }
      if (c === '"' || c === "'") {
        const q = c;
        let j = i + 1;
        let closed = -1;
        while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === q) { closed = j; break; } j++; }
        const val = closed === -1 ? s.slice(i) : s.slice(i, closed + 1);
        push('string', val);
        i = closed === -1 ? s.length : closed + 1;
        continue;
      }
      if (c === "'" && /[\w]/.test(s[i + 1] || '')) { const m2 = /^'([^']*)'/.exec(s.slice(i)); const val = m2 ? m2[0] : c; push('number', val); i += val.length; continue; }
      if (/[0-9]/.test(c)) { const m2 = /^0[xX][0-9a-fA-F]+|^[0-9][0-9_]*(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(s.slice(i)); const val = m2 ? m2[0] : c; push('number', val); i += val.length; continue; }
      const m2 = /^[A-Za-z_]\w*/.exec(s.slice(i));
      if (m2) { const val = m2[0]; push(GO_KEYWORDS.has(val) ? 'keyword' : 'identifier', val); i += val.length; continue; }
      if (/[+\-*/%=<>!&|^~:@]+/.test(c)) { const m3 = /^[+\-*/%=<>!&|^~:@]+/.exec(s.slice(i)); const val = m3 ? m3[0] : c; push('operator', val); i += val.length; continue; }
      i++;
    }
    return { tokens: toks, state };
  }

  function scanCssLine(line, toks, push) {
    const s = line;
    if (/\/\*[\s\S]*?\*\//.test(s)) {
      const parts = s.split(/(\/\*[\s\S]*?\*\/)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\/\*/.test(part)) push('comment', part);
        else {
          const ci = part.indexOf(':');
          if (ci >= 0) { push('property', part.slice(0, ci).trim()); push('value', part.slice(ci + 1).split(';')[0].trim()); }
          else push('text', part);
        }
      }
      return { tokens: toks, state: { mode: 'code' } };
    }
    if (/^\s*@/.test(s.trim())) { push('at-rule', s.trim()); return { tokens: toks, state: { mode: 'code' } }; }
    const openIdx = s.indexOf('{');
    if (openIdx >= 0) {
      const sel = s.slice(0, openIdx).trim();
      if (sel) push('selector', sel);
      push('punctuation', '{');
      const body = s.slice(openIdx + 1);
      const ci = body.indexOf(':');
      if (ci >= 0) { push('property', body.slice(0, ci).trim()); push('value', body.slice(ci + 1).split(';')[0].trim().replace(/\}\s*$/, '')); }
      return { tokens: toks, state: { mode: 'code' } };
    }
    const ci = s.indexOf(':');
    if (ci >= 0) { push('property', s.slice(0, ci).trim()); push('value', s.slice(ci + 1).split(';')[0].trim()); }
    else if (s.trim() !== '') push('text', s);
    return { tokens: toks, state: { mode: 'code' } };
  }

  function scanMarkdownLine(line, toks, push, state) {
    const s = line;
    if (/^\s{0,3}#{1,6}\s/.test(s)) { push('heading', s); return { tokens: toks, state: { mode: 'code' } }; }
    if (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(s)) { push('list', s); return { tokens: toks, state: { mode: 'code' } }; }
    if (/^\s{0,3}>/.test(s)) { push('quote', s); return { tokens: toks, state: { mode: 'code' } }; }
    if (/^\s{0,3}(```|~~~)/.test(s)) { push('code', s); return { tokens: toks, state: { mode: 'fence' } }; }
    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(s)) { push('hr', s); return { tokens: toks, state: { mode: 'code' } }; }
    const inlineT = scanMarkdownInline(s);
    for (const t of inlineT) toks.push(t);
    return { tokens: toks, state: { mode: 'code' } };
  }

  function scanMarkdownInline(s) {
    const toks = [];
    const reBold = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/;
    const reCode = /`([^`]+)`/;
    const reStrike = /~~([\s\S]+?)~~/;
    const reEm = /\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_/;
    const reLink = /\[([^\]]+)\]\(([^)\s]+)\)/;
    const reAuto = /<(https?:\/\/[^\s>]+)>/;
    let rest = String(s);
    let guard = 0;
    while (rest && guard++ < 200) {
      let m;
      if ((m = reBold.exec(rest))) { toks.push({ type: 'bold', value: m[0] }); rest = rest.slice(m[0].length); continue; }
      if ((m = reCode.exec(rest))) { toks.push({ type: 'code', value: m[0] }); rest = rest.slice(m[0].length); continue; }
      if ((m = reStrike.exec(rest))) { toks.push({ type: 'strike', value: m[0] }); rest = rest.slice(m[0].length); continue; }
      if ((m = reEm.exec(rest))) { toks.push({ type: 'italic', value: m[0] }); rest = rest.slice(m[0].length); continue; }
      if ((m = reLink.exec(rest))) { toks.push({ type: 'link', value: m[0] }); rest = rest.slice(m[0].length); continue; }
      if ((m = reAuto.exec(rest))) { toks.push({ type: 'autolink', value: m[0] }); rest = rest.slice(m[0].length); continue; }
      break;
    }
    if (rest) toks.push({ type: 'text', value: rest });
    if (toks.length === 0) toks.push({ type: 'text', value: s });
    return toks;
  }

  function scanHtmlLine(line, toks, push) {
    const s = line;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '<') {
        const closeM = /^<\/\s*([A-Za-z][\w-]*)/.exec(s.slice(i));
        const openM = /^<\s*([A-Za-z][\w-]*)/.exec(s.slice(i));
        const commentM = /^<!--[\s\S]*?-->/.exec(s.slice(i));
        const doctypeM = /^<!DOCTYPE[^>]*>/i.exec(s.slice(i));
        if (commentM) { push('comment', commentM[0]); i += commentM[0].length; continue; }
        if (doctypeM) { push('meta', doctypeM[0]); i += doctypeM[0].length; continue; }
        const m = closeM || openM;
        if (m) {
          if (closeM) { push('punctuation', '</'); push('tag', '</' + m[1] + '>'); }
          else { push('punctuation', '<'); push('tag', '<' + m[1]); }
          i += m[0].length;
          continue;
        }
        i++;
        continue;
      }
      if (c === '=') { push('operator', '='); i++; continue; }
      if (/[A-Za-z_]/.test(c)) {
        const m = /^[A-Za-z_][\w-]*/.exec(s.slice(i));
        const val = m ? m[0] : c;
        const prev = s[i - 1];
        if (prev === '=') push('attribute', val); else push('tag', val);
        i += val.length;
        continue;
      }
      if (/[0-9]/.test(c)) { const m = /^[0-9]+/.exec(s.slice(i)); const val = m ? m[0] : c; push('number', val); i += val.length; continue; }
      if (c === '"' || c === "'") { const q = c; let j = i + 1; let closed = -1; while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === q) { closed = j; break; } j++; } const val = closed === -1 ? s.slice(i) : s.slice(i, closed + 1); push('string', val); i = closed === -1 ? s.length : closed + 1; continue; }
      if (c === '>' || c === '/' || c === '!') { if (c === '>') { push('punctuation', '>'); i++; continue; } i++; continue; }
      i++;
    }
    return { tokens: toks, state: { mode: 'code' } };
  }

  function scanLine(language, line, state) {
    const toks = [];
    const push = (type, value) => { toks.push({ type, value }); };
    if (language === 'javascript') return scanJsLine(line, state, toks, push);
    if (language === 'json') return scanJsonLine(line, toks, push);
    if (language === 'python') return scanPythonLine(line, state, toks, push);
    if (language === 'go') return scanGoLine(line, state, toks, push);
    if (language === 'css') return scanCssLine(line, toks, push);
    if (language === 'markdown') return scanMarkdownLine(line, toks, push, state);
    if (language === 'html') return scanHtmlLine(line, toks, push);
    toks.push({ type: 'text', value: line });
    return { tokens: toks, state };
  }

  function find(text, query, opts) {
    const o = opts || {};
    const src = String(text);
    const pattern = o.regex ? String(query) : String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = o.wholeWord ? '(?<![\\w])(?:' + pattern + ')(?![\\w])' : pattern;
    const regex = new RegExp(body, o.caseSensitive ? 'g' : 'gi');
    const results = [];
    regex.lastIndex = 0;
    let m;
    let guard = 0;
    while ((m = regex.exec(src)) !== null) {
      if (m[0].length === 0) { if (regex.lastIndex >= src.length) break; regex.lastIndex++; continue; }
      results.push({ start: m.index, end: m.index + m[0].length });
      if (guard++ > 100000) break;
    }
    return results;
  }

  function replaceAll(text, query, replacement, opts) {
    const o = opts || {};
    const src = String(text);
    const pattern = o.regex ? String(query) : String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = o.wholeWord ? '(?<![\\w])(?:' + pattern + ')(?![\\w])' : pattern;
    const regex = new RegExp(body, o.caseSensitive ? 'g' : 'gi');
    return src.replace(regex, replacement);
  }

  function lineOfIndex(text, offset) {
    let line = 0;
    for (let i = 0; i < offset && i < text.length; i++) { if (text.charCodeAt(i) === 10) line++; }
    return line;
  }

  function symbolOutline(text, language) {
    const src = String(text);
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    const push = (name, kind, line) => out.push({ name, kind, line });
    if (language === 'javascript') {
      const reFn = /(?:export\s+)?(?:default\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g;
      let m;
      while ((m = reFn.exec(src)) !== null) push(m[1], 'function', lineOfIndex(src, m.index) + 1);
      const reClass = /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g;
      while ((m = reClass.exec(src)) !== null) push(m[1], 'class', lineOfIndex(src, m.index) + 1);
      const reArrow = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;
      while ((m = reArrow.exec(src)) !== null) push(m[1], 'function', lineOfIndex(src, m.index) + 1);
    } else if (language === 'python') {
      for (let ln = 0; ln < lines.length; ln++) {
        let m2 = /^\s*def\s+([A-Za-z_]\w*)/.exec(lines[ln]);
        if (m2) { push(m2[1], 'function', ln + 1); continue; }
        m2 = /^\s*class\s+([A-Za-z_]\w*)/.exec(lines[ln]);
        if (m2) push(m2[1], 'class', ln + 1);
      }
    } else if (language === 'go') {
      for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        let m2 = /^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z]\w*)/.exec(line);
        if (m2) push(m2[1], 'function', ln + 1);
        m2 = /^\s*type\s+([A-Za-z]\w*)/.exec(line);
        if (m2) push(m2[1], 'type', ln + 1);
      }
    }
    return out;
  }

  function indentLines(text, language, options) {
    options = options || {};
    const src = String(text);
    const tabSize = options.tabSize || 2;
    if (options.pos !== undefined) {
      const pos = options.pos;
      const before = src.slice(0, pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineEnd = src.indexOf('\n', pos);
      const lineText = src.slice(lineStart, lineEnd === -1 ? src.length : lineEnd);
      const trimmed = lineText.trim();
      const baseIndent = (lineText.match(/^\s*/) || [''])[0].replace(/\t/g, '  ').length;
      const needsIndent = /[{:\]>[]$/.test(trimmed) || /^\s*([-*+]|\d{1,9}[.)])\s+/.test(lineText);
      return ' '.repeat(baseIndent + (needsIndent ? tabSize : 0));
    }
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    let depth = 0;
    const outLines = [];
    for (const line of lines) {
      const t = line.trim();
      const isCloser = /^[\]}]/.test(t);
      const isOpener = t.endsWith('{') || t.endsWith(':') || t.endsWith('>') || t.endsWith(']') || /^\s*([-*+]|\d{1,9}[.)])\s+/.test(t);
      if (isCloser) depth = Math.max(0, depth - 1);
      outLines.push(' '.repeat(Math.max(0, depth) * tabSize) + t);
      if (isOpener) depth += 1;
    }
    let result = outLines.join('\n');
    if (!/\n$/.test(result) && result !== '') result += '\n';
    return result;
  }

  function toggleComment(text, pos, language) {
    const src = String(text);
    const lang = language || 'text';
    if (lang === 'markdown') return src;
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    let acc = 0;
    let li = 0;
    for (let k = 0; k < lines.length; k++) { if (pos < acc + lines[k].length + 1) { li = k; break; } acc += lines[k].length + 1; }
    const line = lines[li];
    const trimmed = line.trim();
    let outLine;
    if (lang === 'css') {
      const inner = trimmed.replace(/^\/\*/, '').replace(/\*\/$/, '').trim();
      outLine = inner ? '/* ' + inner + ' */' : '/**/';
    } else if (lang === 'html') {
      outLine = trimmed.startsWith('<!--') && trimmed.endsWith('-->') ? trimmed.slice(4, -3) : '<!-- ' + trimmed + ' -->';
    } else {
      const prefixes = { javascript: '//', python: '#', go: '//', json: '//', c: '//', cpp: '//', css: '/*', shell: '#', ruby: '#', php: '//', lua: '--', kotlin: '//', swift: '//', rust: '//' };
      const prefix = prefixes[lang] || '//';
      if (prefix === '/*') {
        outLine = trimmed ? '/* ' + trimmed + ' */' : '/**/';
      } else {
        const hasPrefix = new RegExp('^\\s*' + prefix + '\\s').test(line);
        if (hasPrefix) {
          outLine = line.replace(new RegExp('^\\s*' + prefix + '(.*)$'), '$1').replace(new RegExp('^\\s*' + prefix), '').trimStart();
        } else {
          outLine = prefix + ' ' + trimmed;
        }
      }
    }
    lines[li] = outLine;
    let result = lines.join('\n');
    if (/\r/.test(src)) result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return result;
  }

  function formatDocument(text, language) {
    const src = String(text);
    const lang = language || 'text';
    if (lang === 'json') {
      try { return JSON.stringify(JSON.parse(src), null, 2) + '\n'; } catch (e) { return src; }
    }
    const normalized = src.replace(/\r\n?/g, '\n');
    const tab = { javascript: '  ', python: '    ', go: '    ', html: '  ', css: '  ', markdown: '  ', json: '  ', yaml: '  ', shell: '  ' }[lang] || '  ';
    const lines = normalized.split('\n').map(l => l.replace(/\t/g, tab).replace(/[ \t]+$/g, ''));
    let out = lines.join('\n');
    if (!/\n$/.test(out) && out !== '') out += '\n';
    if (lang === 'css') {
      try {
        const MelCssApi = (typeof require === 'function') ? require('./css') : (typeof window !== 'undefined' ? window.MelCss : null);
        if (MelCssApi && MelCssApi.formatCss) return MelCssApi.formatCss(src);
      } catch (e) { /* fall through to normalized text */ }
      return out;
    }
    return out;
  }

  return {
    AUTO_CLOSE: AUTO_CLOSE,
    EditorDoc: EditorDoc,
    detectLanguage: detectLanguage,
    detectLanguageFromContent: detectLanguageFromContent,
    tokenize: tokenize,
    indentLines: indentLines,
    toggleComment: toggleComment,
    bracketPairs: bracketPairs,
    shouldAutoClose: shouldAutoClose,
    find: find,
    replaceAll: replaceAll,
    symbolOutline: symbolOutline,
    formatDocument: formatDocument
  };
});
