// MelDom - UMD minimal HTML parser/editor tree (Node module.exports + window.MelDom)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MelDom = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const RAW_TEXT_TAGS = new Set(['script', 'style']);

  function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function newTag(tag, attrs) {
    return { type: 'tag', tag: tag, attrs: attrs || {}, children: [], text: null };
  }

  function newTextNode(text, tag) {
    return { type: 'text', tag: tag || null, attrs: {}, children: [], text: String(text) };
  }

  function newCommentNode(text) {
    return { type: 'comment', tag: null, attrs: {}, children: [], text: String(text) };
  }

  function setParent(child, parent) {
    Object.defineProperty(child, 'parent', { value: parent, enumerable: false, configurable: true });
    for (const c of child.children || []) setParent(c, child);
  }

  function parseHtml(html) {
    const root = newTag('#root', {});
    const stack = [root];
    const s = String(html);
    const tagRe = /<\s*(\/)?\s*([A-Za-z][\w-]*)([^>]*?)(\/)?\s*>/g;
    let lastEnd = 0;
    let m;
    while ((m = tagRe.exec(s)) !== null) {
      const text = s.slice(lastEnd, m.index);
      if (text.trim() !== '') {
        const t = newTextNode(text);
        setParent(t, stack[stack.length - 1]);
        stack[stack.length - 1].children.push(t);
      }
      lastEnd = tagRe.lastIndex;
      const closing = !!m[1];
      const tagName = m[2];
      const rawAttrs = m[3] || '';
      const selfClose = !!m[4];
      const lower = tagName.toLowerCase();
      const parent = stack[stack.length - 1];
      if (closing) {
        lastEnd = tagRe.lastIndex;
        for (let k = stack.length - 1; k > 0; k--) {
          if (stack[k].tag && stack[k].tag.toLowerCase() === lower) { stack.length = k; break; }
        }
        continue;
      }
      const attrs = {};
      const attrRe = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let am;
      while ((am = attrRe.exec(rawAttrs)) !== null) {
        const val = am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : (am[5] !== undefined ? am[5] : ''));
        attrs[am[1]] = val;
      }
      const node = newTag(tagName, attrs);
      setParent(node, parent);
      parent.children.push(node);
      const shouldOpen = !selfClose && !VOID_TAGS.has(lower);
      if (shouldOpen) stack.push(node);
      const selfCloseNow = selfClose || VOID_TAGS.has(lower);
      if (!selfCloseNow) {
        const openTagEnd = tagRe.lastIndex;
        const closeStr = '</' + tagName + '>';
        const closeIdx = s.toLowerCase().indexOf(closeStr.toLowerCase(), openTagEnd);
        const innerEnd = closeIdx === -1 ? s.length : closeIdx;
        const inner = s.slice(openTagEnd, innerEnd);
        const stackLen = stack.length;
        const savedTop = stack[stack.length - 1];
        stack.push(node);
        parseInto(node, inner);
        stack.length = stackLen;
        void savedTop;
        // re-point: parseInto pushed/poped relative to its own stack; ensure node.parent set
        node.parent = parent;
        if (node.children) { for (const c of node.children) setParent(c, node); }
        const consumed = (innerEnd - openTagEnd) + closeStr.length;
        tagRe.lastIndex = openTagEnd + consumed;
        lastEnd = tagRe.lastIndex;
      }
    }
    const tail = s.slice(lastEnd);
    if (tail.trim() !== '') {
      const t = newTextNode(tail);
      setParent(t, stack[stack.length - 1]);
      stack[stack.length - 1].children.push(t);
    }
    return root;

    function parseInto(node, content) {
      const stack2 = [node];
      const s2 = content;
      const tagRe2 = /<\s*(\/)?\s*([A-Za-z][\w-]*)([^>]*?)(\/)?\s*>/g;
      let lastEnd2 = 0;
      let m2;
      const parentOf = (cur) => cur;
      while ((m2 = tagRe2.exec(s2)) !== null) {
        const text = s2.slice(lastEnd2, m2.index);
        if (text.trim() !== '') {
          const t = newTextNode(text);
          t.parent = stack2[stack2.length - 1];
          stack2[stack2.length - 1].children.push(t);
        }
        lastEnd2 = tagRe2.lastIndex;
        const closing = !!m2[1];
        const tagName2 = m2[2];
        const rawAttrs2 = m2[3] || '';
        const selfClose2 = !!m2[4];
        const lower2 = tagName2.toLowerCase();
        const parentN = stack2[stack2.length - 1];
        if (closing) {
          lastEnd2 = tagRe2.lastIndex;
          for (let k = stack2.length - 1; k > 0; k--) {
            if (stack2[k].tag && stack2[k].tag.toLowerCase() === lower2) { stack2.length = k; break; }
          }
          continue;
        }
        const attrs2 = {};
        const attrRe2 = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
        let am2;
        while ((am2 = attrRe2.exec(rawAttrs2)) !== null) attrs2[am2[1]] = am2[3] !== undefined ? am2[3] : (am2[4] !== undefined ? am2[4] : (am2[5] !== undefined ? am2[5] : ''));
        const node2 = newTag(tagName2, attrs2);
        node2.parent = parentN;
        parentN.children.push(node2);
        const openEnd = tagRe2.lastIndex;
        const closeStr2 = '</' + tagName2 + '>';
        const closeIdx2 = s2.toLowerCase().indexOf(closeStr2.toLowerCase(), openEnd);
        const innerEnd2 = closeIdx2 === -1 ? s2.length : closeIdx2;
        const len2 = stack2.length;
        stack2.push(node2);
        parseInto(node2, s2.slice(openEnd, innerEnd2));
        stack2.length = len2;
        node2.parent = parentN;
        for (const c of node2.children || []) setParent(c, node2);
        tagRe2.lastIndex = openEnd + ((innerEnd2 - openEnd) + closeStr2.length);
        lastEnd2 = tagRe2.lastIndex;
      }
      const tail2 = s2.slice(lastEnd2);
      if (tail2.trim() !== '') { const t = newTextNode(tail2); t.parent = stack2[stack2.length - 1]; stack2[stack2.length - 1].children.push(t); }
    }
  }

  function textContent(node) {
    if (node.type === 'text') return node.text;
    if (node.type === 'comment') return '';
    let out = '';
    for (const c of node.children || []) out += textContent(c);
    return out;
  }

  function serializeHtml(node) {
    if (node.type === 'text') {
      if (node.tag) return '<' + node.tag + '>' + escapeText(node.text) + '</' + node.tag + '>';
      return escapeText(node.text);
    }
    if (node.type === 'comment') {
      return node.text.charAt(0) === '<' ? node.text : '<!--' + node.text + '-->';
    }
    const tag = node.tag;
    const attrs = Object.keys(node.attrs || {}).map(k => ' ' + k + '="' + escapeAttr(node.attrs[k]) + '"').join('');
    const children = (node.children || []).map(c => serializeHtml(c)).join('');
    if (tag === '#root') return children;
    if (VOID_TAGS.has(String(tag).toLowerCase())) return '<' + tag + attrs + ' />';
    if (node.selfClose) return '<' + tag + attrs + ' />';
    return '<' + tag + attrs + '>' + children + '</' + tag + '>';
  }

  function select(root, path) {
    let node = root;
    const steps = Array.isArray(path) ? path : [path];
    for (const s of steps) {
      if (node.type !== 'tag') return null;
      const children = node.children || [];
      if (typeof s !== 'number' || s < 0 || s >= children.length) return null;
      node = children[s];
    }
    return node;
  }

  function findById(root, id) {
    let found = null;
    const walk = (node) => {
      if (node.type === 'tag') {
        const attrs = node.attrs || {};
        if (attrs && attrs.id === String(id)) { found = node; }
        for (const c of node.children || []) walk(c);
      }
    };
    walk(root);
    return found;
  }

  function pathOf(node) {
    const path = [];
    let cur = node;
    while (cur && cur.parent) {
      const parent = cur.parent;
      const siblings = parent.children || [];
      const idx = siblings.indexOf(cur);
      path.unshift(idx);
      cur = parent;
    }
    return path;
  }

  function setAttribute(node, k, v) {
    if (node.type !== 'tag') return node;
    node.attrs[k] = String(v);
    return node;
  }

  function removeAttribute(node, k) {
    if (node.type !== 'tag') return node;
    delete node.attrs[k];
    return node;
  }

  function setText(node, text) {
    if (node.type !== 'tag') return node;
    node.children = [newTextNode(text)];
    setParent(node.children[0], node);
    return node;
  }

  function insertElement(parent, index, tag, attrs) {
    const node = newTag(tag, attrs);
    setParent(node, parent);
    const children = parent.children || (parent.children = []);
    children.splice(index === undefined ? children.length : index, 0, node);
    return node;
  }

  function removeNode(root, node) {
    const parent = node.parent;
    if (!parent) return false;
    const idx = (parent.children || []).indexOf(node);
    if (idx >= 0) parent.children.splice(idx, 1);
    return true;
  }

  function duplicateNode(root, node) {
    const clone = JSON.parse(JSON.stringify(node, (k, v) => (k === 'parent' ? undefined : v)));
    clone.parent = node.parent;
    const children = node.parent.children || [];
    const idx = children.indexOf(node);
    children.splice(idx + 1, 0, clone);
    return clone;
  }

  function moveNode(root, node, direction) {
    const parent = node.parent;
    if (!parent) return false;
    const children = parent.children || [];
    const idx = children.indexOf(node);
    if (direction === 'up') { if (idx > 0) { const t = children[idx - 1]; children[idx - 1] = node; children[idx] = t; } return true; }
    if (direction === 'down') { if (idx >= 0 && idx < children.length - 1) { const t = children[idx + 1]; children[idx + 1] = node; children[idx] = t; } return true; }
    if (direction === 'first') { if (idx > 0) { children.splice(idx, 1); children.unshift(node); } return true; }
    if (direction === 'last') { if (idx >= 0 && idx < children.length - 1) { children.splice(idx, 1); children.push(node); } return true; }
    if (direction === 'right') {
      const prev = children[idx - 1];
      if (prev && prev.type === 'tag') { const ci = children.indexOf(node); children.splice(ci, 1); prev.children.push(node); node.parent = prev; return true; }
      return false;
    }
    if (direction === 'left') {
      const gp = parent.parent;
      if (gp && gp.type === 'tag') { const gc = gp.children || []; const gi = gc.indexOf(parent); gc.splice(gi + 1, 0, node); node.parent = gp; return true; }
      return false;
    }
    return false;
  }

  function wrapInTag(root, nodes, tag) {
    const parent = nodes.length > 0 ? nodes[0].parent : root;
    const p = parent || root;
    const wrapper = newTag(tag, {});
    wrapper.parent = p;
    const kids = nodes.slice();
    for (const k of kids) { k.parent = wrapper; wrapper.children.push(k); }
    const ref = nodes[0];
    const idx = ref ? p.children.indexOf(ref) : p.children.length;
    p.children.splice(Math.max(idx, 0), 0, wrapper);
    return wrapper;
  }

  function getElementInfo(node) {
    const path = pathOf(node);
    const attrs = node.attrs || {};
    const classes = String(attrs.class || '').split(/\s+/).filter(Boolean);
    const text = textContent(node);
    const preview = String(text).replace(/\s+/g, ' ').trim();
    return {
      tag: node.tag,
      id: attrs.id || '',
      classes: classes,
      attributes: Object.assign({}, attrs),
      textPreview: preview.slice(0, 120),
      path: path
    };
  }

  function buildHtmlDocument(opts) {
    opts = opts || {};
    const title = opts.title || 'Untitled';
    const bodyHtml = opts.bodyHtml !== undefined ? opts.bodyHtml : '';
    const headExtra = opts.headExtra || '';
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + title.replace(/</g, '&lt;') + '</title>\n' + headExtra + '\n</head>\n<body>\n' + bodyHtml + '\n</body>\n</html>\n';
  }

  function extractBody(html) {
    const stripped = String(html).replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<html[^>]*>/gi, '').replace(/<\/html>/gi, '').replace(/<\/body>\s*$/i, '');
    const bodyOpen = /<body[^>]*>/i.exec(stripped);
    const bodyClose = /<\/body>/i.exec(stripped);
    if (bodyOpen && bodyClose) return stripped.slice(bodyOpen.index + bodyOpen[0].length, bodyClose.index);
    return stripped;
  }

  function visualStyleForSelection(node, rect) {
    const r = rect || { top: 0, left: 0, width: 0, height: 0 };
    const isMedia = node && node.tag === 'img';
    const color = isMedia ? '#b18cff' : '#4f9cff';
    return {
      position: 'absolute',
      top: r.top || 0,
      left: r.left || 0,
      width: r.width || 0,
      height: r.height || 0,
      outline: '2px solid ' + color,
      outlineOffset: '2px',
      pointerEvents: 'none',
      zIndex: 9999
    };
  }

  return {
    parseHtml: parseHtml,
    serializeHtml: serializeHtml,
    textContent: textContent,
    select: select,
    findById: findById,
    pathOf: pathOf,
    setAttribute: setAttribute,
    removeAttribute: removeAttribute,
    setText: setText,
    insertElement: insertElement,
    removeNode: removeNode,
    duplicateNode: duplicateNode,
    moveNode: moveNode,
    wrapInTag: wrapInTag,
    getElementInfo: getElementInfo,
    buildHtmlDocument: buildHtmlDocument,
    extractBody: extractBody,
    visualStyleForSelection: visualStyleForSelection
  };
});
