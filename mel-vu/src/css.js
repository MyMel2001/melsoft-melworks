// MelCss - UMD CSS parsing/formatting/validation engine (Node module.exports + window.MelCss)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MelCss = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const KNOWN_PROPERTIES = new Set([
    'align-content', 'align-items', 'align-self', 'all', 'animation', 'animation-delay', 'animation-direction', 'animation-duration', 'animation-fill-mode', 'animation-iteration-count', 'animation-name', 'animation-play-state', 'animation-timing-function', 'aspect-ratio', 'backdrop-filter', 'background', 'background-attachment', 'background-blend-mode', 'background-clip', 'background-color', 'background-image', 'background-origin', 'background-position', 'background-repeat', 'background-size', 'baseline', 'block-size', 'border', 'border-bottom', 'border-bottom-color', 'border-bottom-left-radius', 'border-bottom-right-radius', 'border-bottom-style', 'border-bottom-width', 'border-collapse', 'border-color', 'border-image', 'border-left', 'border-left-color', 'border-left-style', 'border-left-width', 'border-radius', 'border-right', 'border-right-color', 'border-right-style', 'border-right-width', 'border-spacing', 'border-style', 'border-top', 'border-top-color', 'border-top-left-radius', 'border-top-right-radius', 'border-top-style', 'border-top-width', 'border-width', 'bottom', 'box-shadow', 'box-sizing', 'break-after', 'break-before', 'break-inside', 'caption-side', 'caret-color', 'clear', 'clip', 'clip-path', 'color', 'color-scheme', 'column-count', 'column-fill', 'column-gap', 'column-rule', 'column-span', 'column-width', 'columns', 'content', 'counter-increment', 'counter-reset', 'cursor', 'direction', 'display', 'empty-cells', 'filter', 'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-wrap', 'float', 'font', 'font-family', 'font-size', 'font-size-adjust', 'font-stretch', 'font-style', 'font-synthesis', 'font-variant', 'font-weight', 'font-feature-settings', 'gap', 'grid', 'grid-area', 'grid-auto-columns', 'grid-auto-flow', 'grid-auto-rows', 'grid-column', 'grid-column-end', 'grid-column-gap', 'grid-column-start', 'grid-row', 'grid-row-end', 'grid-row-gap', 'grid-row-start', 'grid-template', 'grid-template-areas', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'height', 'hyphens', 'image-rendering', 'inline-size', 'inset', 'isolation', 'justify-content', 'justify-items', 'justify-self', 'left', 'letter-spacing', 'line-break', 'line-height', 'list-style', 'list-style-image', 'list-style-position', 'list-style-type', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'mask', 'mask-image', 'mask-position', 'mask-repeat', 'mask-size', 'max-height', 'max-inline-size', 'max-width', 'min-height', 'min-inline-size', 'min-width', 'mix-blend-mode', 'object-fit', 'object-position', 'opacity', 'order', 'outline', 'outline-color', 'outline-offset', 'outline-style', 'outline-width', 'overflow', 'overflow-wrap', 'overflow-x', 'overflow-y', 'overscroll-behavior', 'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'page', 'paint-order', 'perspective', 'perspective-origin', 'place-content', 'place-items', 'place-self', 'pointer-events', 'position', 'quotes', 'resize', 'right', 'rotate', 'row-gap', 'ruby-align', 'ruby-position', 'scale', 'scroll-behavior', 'scroll-margin', 'scroll-padding', 'scroll-snap-align', 'scroll-snap-area', 'scroll-snap-type', 'scrollbar-color', 'scrollbar-width', 'shape-outside', 'table-layout', 'tab-size', 'text-align', 'text-combine-upright', 'text-decoration', 'text-decoration-color', 'text-decoration-line', 'text-decoration-style', 'text-indent', 'text-justify', 'text-orientation', 'text-overflow', 'text-rendering', 'text-shadow', 'text-transform', 'top', 'touch-action', 'transform', 'transform-box', 'transform-origin', 'transform-style', 'transition', 'transition-delay', 'transition-duration', 'transition-property', 'transition-timing-function', 'transition-behavior', 'translate', 'unicode-bidi', 'user-select', 'vertical-align', 'visibility', 'white-space', 'widows', 'width', 'will-change', 'word-break', 'word-spacing', 'word-wrap', 'writing-mode', 'z-index', 'zoom'
  ]);

  const KNOWN_AT_RULES = new Set([
    'media', 'supports', 'keyframes', 'import', 'charset', 'font-face', 'namespace', 'page', 'layer', 'container', 'property', 'counter-style', 'viewport', 'document', 'scope', 'starting-style'
  ]);

  function isKnownProperty(prop) {
    const p = String(prop || '').trim().toLowerCase();
    if (p === '' || p === '*') return false;
    if (p.startsWith('--')) return true;
    const base = p.replace(/^-+(?:webkit|moz|ms|o|khtml|epub|apple|wap|prism|rhythm)-/, '');
    if (KNOWN_PROPERTIES.has(base)) return true;
    const kebab = p.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    if (KNOWN_PROPERTIES.has(kebab)) return true;
    return false;
  }

  function parseCss(text) {
    const src = String(text);
    const rules = [];
    const n = src.length;
    let i = 0;

    function skipWsAndComments(pos) {
      let p = pos;
      while (p < n) {
        const c = src[p];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { p++; continue; }
        if (c === '/' && src[p + 1] === '*') {
          const end = src.indexOf('*/', p + 2);
          p = end === -1 ? n : end + 2;
          continue;
        }
        break;
      }
      return p;
    }

    function readBlockEnd(start) {
      let depth = 1;
      let p = start;
      while (p < n && depth > 0) {
        const c = src[p];
        if (c === '"' || c === "'") { const q = c; p++; while (p < n && src[p] !== q) { if (src[p] === '\\') p++; p++; } continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return p + 1; }
        p++;
      }
      return n;
    }

    function splitTop(s, sep) {
      const out = [];
      let depth = 0;
      let quote = null;
      let cur = '';
      for (let k = 0; k < s.length; k++) {
        const ch = s[k];
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur);
      return out;
    }

    function parseDecls(blockEnd, start) {
      const body = src.slice(start, blockEnd - 1);
      const decls = [];
      let buf = '';
      let depth = 0;
      let quote = null;
      let p = 0;
      const flush = () => {
        const parts = splitTop(buf, ';');
        for (const part of parts) {
          const seg = part.trim();
          if (!seg) continue;
          const ci = seg.indexOf(':');
          if (ci < 0) continue;
          const prop = seg.slice(0, ci).trim();
          let val = seg.slice(ci + 1).trim();
          let important = false;
          const impM = /!important\s*$/i.exec(val);
          if (impM) { important = true; val = val.slice(0, impM.index).trim(); }
          decls.push({ property: prop, value: val, important });
        }
        buf = '';
      };
      while (p < body.length) {
        const ch = body[p];
        if (ch === '"' || ch === "'") { const q = ch; buf += ch; p++; while (p < body.length && body[p] !== q) { buf += body[p]; if (body[p] === '\\') { buf += body[p + 1] || ''; p++; } p++; } buf += q; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === ';') { flush(); p++; continue; }
        buf += ch;
        p++;
      }
      flush();
      return decls;
    }

    function walkBlock(start, media) {
      const rules = [];
      let p = start;
      while (p < n) {
        p = skipWsAndComments(p);
        if (p >= n) break;
        if (src[p] === '}') { p++; break; }
        const preStart = p;
        let prelude = '';
        let depthQ = 0;
        let quoteC = null;
        while (p < n) {
          const c = src[p];
          if (quoteC) { prelude += c; if (c === quoteC) quoteC = null; p++; continue; }
          if (c === '"' || c === "'") { quoteC = c; prelude += c; p++; continue; }
          if (c === '(' || c === '[') depthQ++;
          if (c === ')' || c === ']') depthQ--;
          if (depthQ === 0 && (c === '{' || c === ';')) break;
          prelude += c;
          p++;
        }
        const preludeTrim = prelude.trim();
        const blockContentStart = p;
        const isBlock = src[p] === '{';
        if (src[p] === ';') { p++; continue; }
        if (!isBlock) { p = blockContentStart; continue; }
        p++;
        const innerEnd = readBlockEnd(p);
        const innerStart = p;
        const lower = preludeTrim.toLowerCase();
        const m = /^@([a-z0-9-]+)/.exec(lower);
        const atName = m ? m[1] : '';
        if (['media', 'supports', 'layer', 'container'].indexOf(atName) >= 0) {
          const childMedia = media ? (media + ' and ') + preludeTrim.replace(/^@([a-zA-Z0-9-]+)\s*/, '') : preludeTrim.replace(/^@([a-zA-Z0-9-]+)\s*/, '');
          const child = walkBlock(innerStart, childMedia);
          for (const r of child) rules.push(r);
        } else if (atName === 'keyframes') {
          p = innerEnd;
        } else {
          const decls = parseDecls(innerEnd, innerStart);
          const selectors = preludeTrim.split(',').map(s2 => s2.trim()).filter(Boolean);
          for (const sel of selectors) {
            rules.push({
              selectors: [{ text: sel, specificity: specificityOf(sel) }],
              declarations: decls.map(d => ({ ...d, spec: specificityOf(sel) })),
              media: media,
              sourceStart: sourceStartOf(preludeTrim, src, prelude),
              sourceEnd: sourceEndOf(innerEnd)
            });
          }
        }
        p = innerEnd;
        continue;
      }
      return rules;
    }

    function sourceStartOf(prelude, src2, preludeStr) { return preludeStr ? src2.indexOf(preludeStr) : 0; }
    function sourceEndOf(idx) { return idx; }

    return walkBlock(0, null);
  }

  function specificityOf(sel) { return specificity(sel); }

  function formatCss(text) {
    const ast = parseCss(text);
    const groups = [];
    let current = null;
    const pushEntry = (entry) => {
      if (entry.media !== null && entry.media !== undefined) {
        if (!current || current.media !== entry.media) { current = { media: entry.media, rules: [] }; groups.push(current); }
      } else if (!current) { current = { media: null, rules: [] }; groups.push(current); }
      current.rules.push(entry);
    };
    for (const e of ast) {
      if (e.comment || e.statements) {
        if (!current) { current = { media: null, rules: [] }; groups.push(current); }
        current.rules.push(e);
      } else {
        pushEntry(e);
      }
    }
    const parts = [];
    for (const g of groups) {
      for (const r of g.rules) {
        if (r.comment) { parts.push('  ' + r.comment + '\n'); continue; }
        if (r.statements) { parts.push(r.statements + '\n'); continue; }
        if (g.media) parts.push('@media ' + g.media + ' {\n');
        const pad = g.media ? '  ' : '';
        parts.push(pad + r.selectors.map(s => s.text).join(', ') + ' {\n');
        for (const d of r.declarations) parts.push(pad + '  ' + d.property + ': ' + d.value + (d.important ? ' !important' : '') + ';\n');
        parts.push(pad + '}');
        if (g.media) parts.push('\n}\n');
        else parts.push('\n');
      }
    }
    return parts.join('');
  }

  function minifyCss(text) {
    const ast = parseCss(text);
    const groups = [];
    let current = null;
    const pushEntry = (entry) => {
      if (entry.media !== null && entry.media !== undefined) {
        if (!current || current.media !== entry.media) { current = { media: entry.media, rules: [] }; groups.push(current); }
      } else if (!current) { current = { media: null, rules: [] }; groups.push(current); }
      current.rules.push(entry);
    };
    for (const e of ast) {
      if (e.comment) { if (!current) { current = { media: null, rules: [] }; groups.push(current); } current.rules.push(e); continue; }
      if (e.statements) { if (!current) { current = { media: null, rules: [] }; groups.push(current); } current.rules.push(e); continue; }
      pushEntry(e);
    }
    const parts = [];
    for (const g of groups) {
      let body = '';
      for (const r of g.rules) {
        if (r.comment) continue;
        if (r.statements) { parts.push(r.statements.trim() + ';'); continue; }
        const hasDecl = r.declarations && r.declarations.length > 0;
        if (!hasDecl) continue;
        const declStr = r.declarations.map(d => d.property + ':' + d.value + (d.important ? ' !important' : '')).join(';');
        if (body.length > 0) body += '\n';
        body += r.selectors.map(s => s.text).join(',') + '{' + declStr + '}';
      }
      if (g.media) parts.push('@media ' + g.media + ' {\n' + body + '\n}');
      else parts.push(body);
    }
    return parts.filter(p => p !== '').join('\n') + '\n';
  }

  function validateCss(text) {
    const src = String(text);
    const problems = [];
    const lines = src.split('\n');
    let depth = 0;
    let lastSelector = '';
    const seenProps = new Map();
    const checkDecls = (part, lineNo) => {
      const segs = String(part).split(';').map(s => s.trim()).filter(s => s !== '');
      for (const seg of segs) {
        if (!seg) continue;
        const ci = seg.indexOf(':');
        if (ci < 0) { problems.push({ line: lineNo, message: 'Missing ":" in declaration: "' + seg + '"', severity: 'error' }); continue; }
        const prop = seg.slice(0, ci).trim();
        let val = seg.slice(ci + 1).trim();
        const important = /!important$/i.test(val);
        if (important) val = val.replace(/!important\s*$/i, '').trim();
        if (!val) problems.push({ line: lineNo, message: 'Empty value for property "' + prop + '"', severity: 'error' });
        if (!isKnownProperty(prop)) problems.push({ line: lineNo, message: 'Unknown property "' + prop + '"', severity: 'error' });
        const key = (lastSelector ? lastSelector + ' >> ' : '') + prop.toLowerCase();
        const seen = seenProps.get(key) || new Set();
        if (seen.has(prop.toLowerCase())) problems.push({ line: lineNo, message: 'Duplicate property "' + prop + '" in rule', severity: 'warning' });
        seen.add(prop.toLowerCase());
      }
    };
    for (let ln = 0; ln < lines.length; ln++) {
      const line = lines[ln];
      const lineNo = ln + 1;
      const working = line.replace(/\/\*[\s\S]*?\*\//g, '');
      if (depth > 0) {
        const trimmed = working.trim();
        if (trimmed === '') continue;
        if (/^@/.test(trimmed)) {
          const atM = /^@([a-zA-Z0-9-]+)/.exec(trimmed);
          const atName = atM ? atM[1] : '';
          if (!KNOWN_AT_RULES.has(atName)) problems.push({ line: lineNo, message: 'Unknown at-rule "@' + atName + '"', severity: 'error' });
          continue;
        }
        if (/^\}/.test(trimmed)) { depth = Math.max(0, depth - 1); continue; }
        const openM = /\{/.exec(working);
        if (openM) {
          depth++;
          lastSelector = working.slice(0, openM.index).trim();
          const closeIdx = working.indexOf('}', openM.index);
          const declText = closeIdx === -1 ? working.slice(openM.index + 1) : working.slice(openM.index + 1, closeIdx);
          checkDecls(declText, lineNo);
          if (closeIdx !== -1) depth = Math.max(0, depth - 1);
          continue;
        }
        checkDecls(working, lineNo);
      } else {
        const trimmed = line.trim();
        if (/^@/.test(trimmed)) {
          const atM = /^@([a-zA-Z0-9-]+)/.exec(trimmed);
          const atName = atM ? atM[1] : '';
          if (!KNOWN_AT_RULES.has(atName)) problems.push({ line: lineNo, message: 'Unknown at-rule "@' + atName + '"', severity: 'error' });
        }
        const openM = /\{/.exec(line);
        if (openM) {
          depth++;
          lastSelector = line.slice(0, openM.index).trim();
          const closeIdx = line.indexOf('}', openM.index);
          const declText = closeIdx === -1 ? line.slice(openM.index + 1) : line.slice(openM.index + 1, closeIdx);
          checkDecls(declText, lineNo);
          if (closeIdx !== -1) depth = Math.max(0, depth - 1);
        }
      }
    }
    if (depth > 0) problems.push({ line: lines.length, message: 'Missing closing "}"', severity: 'error' });
    return problems;
  }

  function specificity(selector) {
    const sels = String(selector).split(',').map(s => s.trim()).filter(Boolean);
    let best = null;
    for (const s of sels) {
      const st = specOne(s);
      if (!best || compareSpecificity(st, best) > 0) best = st;
    }
    return best || { a: 0, b: 0, c: 0 };
  }

  function compareSpecificity(a, b) {
    const ka = a || { a: 0, b: 0, c: 0 };
    const kb = b || { a: 0, b: 0, c: 0 };
    const kaa = [ka.a, ka.b, ka.c];
    const kbb = [kb.a, kb.b, kb.c];
    for (let i = 0; i < 3; i++) { if (kaa[i] !== kbb[i]) return kaa[i] < kbb[i] ? -1 : 1; }
    return 0;
  }

  function specOne(comp) {
    const s = String(comp).replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"|'[^']*'/g, ' ').trim();
    const st = { a: 0, b: 0, c: 0 };
    const ids = s.match(/#[A-Za-z_][\w-]*/g) || [];
    st.a += ids.length;
    let rest = s.replace(/#[A-Za-z_][\w-]*/g, ' ');
    const classes = rest.match(/\.[A-Za-z_][\w-]*/g) || [];
    st.b += classes.length;
    rest = rest.replace(/\.[A-Za-z_][\w-]*/g, ' ');
    const attrs = rest.match(/\[[^\]]*\]/g) || [];
    st.b += attrs.length;
    rest = rest.replace(/\[[^\]]*\]/g, ' ');
    const pes = rest.match(/::[A-Za-z_][\w-]*/g) || [];
    st.c += pes.length;
    rest = rest.replace(/::[A-Za-z_][\w-]*/g, ' ');
    const pces = rest.match(/:[A-Za-z_][\w-]*(\([^)]*\))?/g) || [];
    let restFinal = rest;
    for (const mm of pces) {
      const m = /^:([A-Za-z_][\w-]*)(\([^)]*\))?$/.exec(mm);
      const name = m ? m[1] : '';
      const arg = m ? m[2] : null;
      if (name === 'where') { if (arg) { const st2 = specOne(arg.slice(1, -1)); st.a += st2.a; st.b += st2.b; st.c += st2.c; } }
      else if (name === 'not' || name === 'is' || name === 'has') { if (arg) { const st2 = specOne(arg.slice(1, -1)); st.a += st2.a; st.b += st2.b; st.c += st2.c; } else { st.b += 1; } }
      else { st.b += 1; }
      restFinal = restFinal.split(mm).join(' ');
    }
    const els = restFinal.match(/[A-Za-z_][\w-]*/g) || [];
    st.c += els.length;
    return st;
  }

  function selectorForElement(path) {
    const el = Array.isArray(path) ? path[path.length - 1] : path;
    if (!el) return null;
    const tag = el.tag || el.name || el.tagName || el.type || '';
    const id = el.id || (el.attr && el.attr && el.attr.id) || '';
    if (id) {
      const t = tag || '#placeholder';
      return t + '#' + id;
    }
    if (el.classes && el.classes.length) {
      const t = tag || '';
      return t + '.' + el.classes.join('.');
    }
    const index = el.indexAmongSiblings !== undefined ? el.indexAmongSiblings : 0;
    const siblingTags = el.siblingTags || [tag];
    const sameTagCount = (siblingTags || []).filter(t => t === tag).length;
    const nth = (siblingTags || []).slice(0, index).filter(t => t === tag).length + 1;
    const sel = sameTagCount > 1 ? tag + ':nth-of-type(' + nth + ')' : (tag || '*');
    return sel;
  }

  function splitCompound(sel) {
    const s = String(sel).trim();
    const m = /^([A-Za-z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(s);
    const tag = m && m[1] ? m[1] : (m && m[1] === '*' ? '*' : '*');
    const rest = m ? (m[2] || '') : '';
    const out = { tag: tag, id: null, classes: [] };
    const parts = rest.match(/[#.][\w-]+/g) || [];
    for (const p of parts) { if (p[0] === '#') out.id = p.slice(1); else out.classes.push(p.slice(1)); }
    const pseudo = /:([A-Za-z_][\w-]*)(?:\(([^)]*)\))?/.exec(rest);
    if (pseudo) {
      const name = pseudo[1];
      const arg = pseudo[2];
      if (name === 'nth-of-type') out.nthOfType = parseInt(arg, 10) || 1;
      else if (name === 'nth-child') out.nthChild = parseInt(arg, 10) || 1;
      else out.pseudoClasses = (out.pseudoClasses || []).concat([name]);
    }
    return out;
  }

  function compoundMatches(comp, el) {
    if (!el) return false;
    const tag = (el.tag || '').toLowerCase();
    if (comp.tag && comp.tag !== '*' && comp.tag.toLowerCase() !== tag) return false;
    if (comp.id) {
      if (comp.id !== (el.id || '')) return false;
      return true;
    }
    if (comp.classes) {
      const classes = el.classes || [];
      for (const cls of comp.classes) { if (!classes.includes(cls)) return false; }
    }
    if (comp.nthOfType) {
      const idx = el.indexAmongSiblings !== undefined ? el.indexAmongSiblings : 0;
      const sameBefore = (el.siblingTags || []).slice(0, idx).filter(t => t === el.tag).length;
      if (sameBefore + 1 !== comp.nthOfType) return false;
    }
    if (comp.nthChild) { return true; }
    return true;
  }

  function matchSimple(selector, path) {
    const el = Array.isArray(path) ? path[path.length - 1] : path;
    if (!el) return false;
    const targetEl = Array.isArray(path) ? path[path.length - 1] : path;
    const sels = String(selector).split(',').map(s => s.trim()).filter(Boolean);
    if (sels.length === 0) return false;
    const ancestors = Array.isArray(path) ? path.slice(0, -1) : [targetEl].slice(0, -1);
    const stack = ancestors.slice().reverse();
    const canMatch = (compound, elem) => compoundMatches(splitCompound(compound), elem);
    const rec = (comps, cIdx, aIdx) => {
      if (cIdx < 0) return true;
      if (aIdx < 0) return false;
      if (canMatch(comps[cIdx], stack[aIdx])) { if (rec(comps, cIdx - 1, aIdx - 1)) return true; }
      return rec(comps, cIdx, aIdx - 1);
    };
    for (const sel of sels) {
      const comps = sel.split(/\s+/).map(s => s.trim()).filter(Boolean);
      if (comps.length === 0) continue;
      const lastComp = splitCompound(comps[comps.length - 1]);
      if (!compoundMatches(lastComp, targetEl)) continue;
      if (comps.length === 1) return true;
      if (rec(comps, comps.length - 2, stack.length - 1)) return true;
    }
    return false;
  }

  function boxModel(opts) {
    opts = opts || {};
    const width = Number(opts.width) || 0;
    const height = Number(opts.height) || 0;
    const boxSizing = opts.boxSizing || 'content-box';
    const margin = opts.margin || { top: 0, right: 0, bottom: 0, left: 0 };
    const padding = opts.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const border = opts.border || { top: 0, right: 0, bottom: 0, left: 0 };
    const num = (v) => Number(v) || 0;
    const padT = num(padding.top), padR = num(padding.right), padB = num(padding.bottom), padL = num(padding.left);
    const bT = num(border.top), bR = num(border.right), bB = num(border.bottom), bL = num(border.left);
    const contentWidth = boxSizing === 'border-box' ? Math.max(0, width - padL - padR - bL - bR) : width;
    const contentHeight = boxSizing === 'border-box' ? Math.max(0, height - padT - padB - bT - bB) : height;    const borderBoxWidth = contentWidth + padL + padR + bL + bR;
    const borderBoxHeight = contentHeight + padT + padB + bT + bB;
    const marginBoxWidth = borderBoxWidth + num(margin.left) + num(margin.right);
    const marginBoxHeight = borderBoxHeight + num(margin.top) + num(margin.bottom);
    return { contentWidth, contentHeight, borderBoxWidth, borderBoxHeight, marginBoxWidth, marginBoxHeight };
  }

  function collapseMargins(a, b) {
    const ma = (a && a.margin) || a || {};
    const mb = (b && b.margin) || b || {};
    const bottomOfA = Number(ma.bottom !== undefined ? ma.bottom : (a && a.bottom)) || 0;
    const topOfB = Number(mb.top !== undefined ? mb.top : (b && b.top)) || 0;
    let collapsed;
    if (bottomOfA > 0 && topOfB > 0) collapsed = Math.max(bottomOfA, topOfB);
    else if (bottomOfA < 0 && topOfB < 0) collapsed = Math.min(bottomOfA, topOfB);
    else collapsed = 0;
    return { collapsed: collapsed, value: collapsed, top: Number(ma.top || 0), bottom: Number(mb.bottom || 0) };
  }

  function computeStyle(ast, path, inherited) {
    const base = inherited || {};
    const out = {};
    for (const k of Object.keys(base)) out[k] = base[k];
    const bestByProp = new Map();
    const rules = ast || [];
    let order = 0;
    for (const rule of rules) {
      if (rule.statements || !rule.selectors) continue;
      const selsList = [];
      let selectorMatched = false;
      for (const sel of rule.selectors) {
        const sels = String(sel.text).split(',').map(s => s.trim()).filter(Boolean);
        for (const s of sels) {
          if (matchSimple(s, path)) { selsList.push({ selector: s, spec: specificity(s) }); selectorMatched = true; break; }
        }
      }
      if (!selectorMatched) { order++; continue; }
      const seenHere = new Set();
      for (const d of (rule.declarations || [])) {
        const key = d.property.toLowerCase();
        if (seenHere.has(key)) continue;
        seenHere.add(key);
        const imp = d.important ? 1 : 0;
        const prev = bestByProp.get(key);
        let replace = false;
        if (!prev) replace = true;
        else if (imp > prev.imp) replace = true;
        else if (imp === prev.imp) {
          const cmp = compareSpecificity(d.spec, prev.spec);
          if (cmp > 0) replace = true;
          else if (cmp === 0 && order > prev.order) replace = true;
        }
        if (replace) bestByProp.set(key, { value: d.value, imp, spec: d.spec, order });
      }
      order++;
    }
    for (const [key, info] of bestByProp) out[key] = info.value;
    return out;
  }

  return {
    parseCss: parseCss,
    formatCss: formatCss,
    minifyCss: minifyCss,
    validateCss: validateCss,
    specificity: specificity,
    compareSpecificity: compareSpecificity,
    selectorForElement: selectorForElement,
    matchSimple: matchSimple,
    boxModel: boxModel,
    collapseMargins: collapseMargins,
    computeStyle: computeStyle
  };
});
