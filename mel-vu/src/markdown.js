// MelMarkdown - UMD markdown <-> HTML engine (Node module.exports + window.MelMarkdown)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MelMarkdown = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function decodeEntities(s) {
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); });
  }

  function renderInline(src) {
    const s = String(src);
    let out = '';
    let i = 0;
    const reCode = /`([^`]+)`/y;
    const reImg = /!\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"[^"]*")?\s*\)/y;
    const reLink = /\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"[^"]*")?\s*\)/y;
    const reAuto = /<(https?:\/\/[^\s<>]+)>/y;
    const reStrong = /(\*\*|__)([\s\S]*?)\1/y;
    const reStrike = /~~([\s\S]*?)~~/y;
    const reEm = /\*([^*\n]+)\*/y;
    const reUnderscoreEm = /(?<![\w\\])_([^_\n]+)_(?![\w\\])/y;
    while (i < s.length) {
      if (s[i] === '\\') {
        if (s[i + 1] === '\n') { out += '\n'; i += 2; continue; }
        out += escapeHtml(s[i + 1] || '');
        i += 2;
        continue;
      }
      if (s[i] === '\n') {
        if (i >= 2 && s[i - 1] === ' ' && s[i - 2] === ' ') { out += '<br>'; }
        else if (s[i - 1] === '\\') { out += '<br>'; }
        out += '\n';
        i++;
        continue;
      }
      let m;
      reCode.lastIndex = i;
      if ((m = reCode.exec(s)) && m.index === i) { out += '<code>' + escapeHtml(m[1]) + '</code>'; i += m[0].length; continue; }
      reImg.lastIndex = i;
      if ((m = reImg.exec(s)) && m.index === i) { out += '<img src="' + escapeHtml(m[2]) + '" alt="' + escapeHtml(m[1]) + '" />'; i += m[0].length; continue; }
      reLink.lastIndex = i;
      if ((m = reLink.exec(s)) && m.index === i) { out += '<a href="' + escapeHtml(m[2]) + '">' + renderInline(m[1]) + '</a>'; i += m[0].length; continue; }
      reAuto.lastIndex = i;
      if ((m = reAuto.exec(s)) && m.index === i) { out += '<a href="' + escapeHtml(m[1]) + '">' + escapeHtml(m[1]) + '</a>'; i += m[0].length; continue; }
      reStrong.lastIndex = i;
      if ((m = reStrong.exec(s)) && m.index === i) { out += '<strong>' + renderInline(m[2]) + '</strong>'; i += m[0].length; continue; }
      reStrike.lastIndex = i;
      if ((m = reStrike.exec(s)) && m.index === i) { out += '<del>' + renderInline(m[1]) + '</del>'; i += m[0].length; continue; }
      reEm.lastIndex = i;
      if ((m = reEm.exec(s)) && m.index === i) { out += '<em>' + renderInline(m[1]) + '</em>'; i += m[0].length; continue; }
      reUnderscoreEm.lastIndex = i;
      if ((m = reUnderscoreEm.exec(s)) && m.index === i) { out += '<em>' + renderInline(m[1]) + '</em>'; i += m[0].length; continue; }
      if (s[i] === '<') {
        // Raw inline HTML passes through unescaped so previews render like NVU.
        const closeIdx = s.indexOf('>', i);
        const end = closeIdx === -1 ? s.length : closeIdx + 1;
        out += s.slice(i, end);
        i = end;
        continue;
      }
      out += s[i];
      i++;
    }
    return out;
  }

  function splitTableRow(line) {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let k = 0; k < line.length; k++) {
      const c = line[k];
      if (c === '"') { inQuotes = !inQuotes; }
      if (c === '|' && !inQuotes) { cells.push(cur); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur);
    return cells.map(c => c.trim());
  }

  function isListLine(l) {
    return /^\s*([-*+]|\d{1,9}[.)])\s+/.test(l);
  }

  function buildList(lines, ordered, depth) {
    const baseIndent = (/^\s*/.exec(lines[0])[0]).length;
    const items = [];
    let cur = null;
    for (const l of lines) {
      const m = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/.exec(l);
      if (m && m[1].length <= baseIndent) {
        cur = { content: m[4].trim() === '' ? [] : [m[4]] };
        items.push(cur);
      } else if (cur) {
        cur.content.push(l);
      } else {
        cur = { content: (m && m[4]) ? [m[4]] : [] };
        items.push(cur);
      }
    }
    const tag = ordered ? 'ol' : 'ul';
    const lis = items.map((item, idx) => renderListItem(item, ordered, depth, idx));
    const open = '<' + tag + (depth > 0 ? ' class="nested"' : '') + '>';
    const close = '</' + tag + '>';
    return open + lis.join('') + close;
  }

  function renderListItem(item, ordered, depth, idx) {
    const first = item.content[0] || '';
    const m0 = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/.exec(first);
    const shift = m0 ? (m0[1] ? m0[1].length : 0) + m0[2].length + m0[3].length : 0;
    const contentLines = item.content.map((l, li) => li === 0 ? l : l.replace(new RegExp('^\\s{0,' + Math.max(shift, 0) + '}'), ''));
    const segments = [];
    let curSeg = null;
    for (const l of contentLines) {
      if (isListLine(l)) { if (curSeg) { segments.push(curSeg); curSeg = null; } segments.push({ list: true, lines: [l] }); }
      else { if (!curSeg) curSeg = { list: false, lines: [] }; curSeg.lines.push(l); }
    }
    if (curSeg) segments.push(curSeg);
    const rendered = segments.map(seg => {
      if (seg.list) {
        const nestedOrdered = /^\s*\d+[.)]\s+/.test(seg.lines[0]);
        return buildList(seg.lines, nestedOrdered, depth + 1);
      }
      const text = seg.lines.map(l => l.trim()).join('\n').trim();
      if (!text) return '';
      return text.includes('\n') ? '<p>' + renderInline(text) + '</p>' : renderInline(text);
    });
    const body = rendered.filter(r => r !== '').join('');
    return '<li>' + body + '</li>';
  }

  function markdownToHtml(md) {
    const src = String(md).replace(/\r\n?/g, '\n');
    const lines = src.split('\n');
    const out = [];
    let i = 0;
    const n = lines.length;
    const nextIsBlockStart = (idx) => {
      if (idx >= n) return true;
      const l = lines[idx];
      if (/^\s*$/.test(l)) return true;
      if (/^\s{0,3}#{1,6}\s/.test(l)) return true;
      if (/^\s{0,3}>/.test(l)) return true;
      if (/^\s{0,3}(```|~~~)/.test(l)) return true;
      if (/^\s{0,3}([-*+]|\d+[.)])\s+/.test(l)) return true;
      if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) return true;
      if (/^\s{0,3}\|/.test(l)) return true;
      if (/^ {4}/.test(l)) return true;
      return false;
    };

    while (i < n) {
      const line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      let fm = /^(\s{0,3})(`{3,}|~{3,})\s*(\S*)\s*$/.exec(line);
      if (fm) {
        const fence = fm[2][0];
        const minLen = fm[2].length;
        const buf = [];
        i++;
        while (i < n) {
          const cf = /^(\s{0,3})(```+|~~~+)\s*$/.exec(lines[i]);
          if (cf && cf[2][0] === fence && cf[2].length >= minLen) { i++; break; }
          buf.push(lines[i]);
          i++;
        }
        out.push('<pre><code' + (fm[3] ? ' class="language-' + escapeHtml(fm[3]) + '"' : '') + '>' + escapeHtml(buf.join('\n')) + (buf.length ? '\n' : '') + '</code></pre>');
        continue;
      }

      if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr />'); i++; continue; }

      const hm = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (hm) {
        const lvl = hm[1].length;
        out.push('<h' + lvl + '>' + renderInline(hm[2]) + '</h' + lvl + '>');
        i++;
        continue;
      }

      if (/^\s{0,3}>/.test(line)) {
        const bufQ = [];
        while (i < n && /^\s{0,3}>/.test(lines[i])) { bufQ.push(lines[i].replace(/^\s{0,3}> ?/, '')); i++; }
        out.push('<blockquote>' + markdownToHtml(bufQ.join('\n')) + '</blockquote>');
        continue;
      }

      if (/^\s{0,3}\|/.test(line) && i + 1 < n && /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const header = splitTableRow(line);
        const delim = splitTableRow(lines[i + 1]);
        const aligns = delim.map(d => {
          if (d.startsWith(':') && d.endsWith(':')) return 'center';
          if (d.endsWith(':')) return 'right';
          if (d.startsWith(':')) return 'left';
          return 'left';
        });
        const rows = [];
        i += 2;
        while (i < n && /^\s*\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) { rows.push(splitTableRow(lines[i])); i++; }
        let theadHtml = '<thead><tr>';
        for (let k = 0; k < header.length; k++) theadHtml += '<th style="text-align:' + (aligns[k] || 'left') + '">' + escapeHtml(header[k]) + '</th>';
        theadHtml += '</tr></thead>';
        let tbodyHtml = '<tbody>';
        for (const r of rows) tbodyHtml += '<tr>' + r.map(c => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>';
        tbodyHtml += '</tbody>';
        out.push('<table>' + theadHtml + tbodyHtml + '</table>');
        continue;
      }

      if (/^\s{0,3}([-*+]|\d+[.)])\s+/.test(line)) {
        const bufL = [];
        let started = false;
        while (i < n) {
          const l = lines[i];
          if (/^\s{0,3}([-*+]|\d+[.)])\s+/.test(l)) { started = true; bufL.push(l); i++; continue; }
          if (started && /^\s*$/.test(l)) { bufL.push(l); i++; continue; }
          if (started && /^ {4}/.test(l)) { bufL.push(l); i++; continue; }
          break;
        }
        const ordered = /^\s*\d+[.)]\s+/.test(bufL[0]);
        out.push(buildList(bufL, ordered, 0));
        continue;
      }

      if (/^ {4}/.test(line) || /^\t/.test(line)) {
        const bufI = [];
        while (i < n && (/^ {4}/.test(lines[i]) || /^\t/.test(lines[i]) || (/^\s*$/.test(lines[i]) && i + 1 < n && (/^ {4}/.test(lines[i + 1]) || /^\t/.test(lines[i + 1]))))) { bufI.push(lines[i]); i++; }
        out.push('<pre><code>' + escapeHtml(bufI.join('\n').replace(/\n$/, '')) + '</code></pre>');
        continue;
      }

      const bufP = [];
      while (i < n && !/^\s*$/.test(lines[i]) && !nextIsBlockStart(i)) { bufP.push(lines[i]); i++; }
      const ptext = bufP.map(l => l.replace(/\s+$/, '')).join('\n');
      out.push('<p>' + renderInline(ptext) + '</p>');
    }

    let html = out.join('\n');
    html = html.replace(/\n{3,}/g, '\n\n');
    return html.trim() + '\n';
  }

  function inlineSimpleHtml(inner) {
    let t = String(inner);
    t = t.replace(/<br\s*\/?>/gi, '\n');
    t = t.replace(/<[^>]*>/g, '');
    return decodeEntities(t);
  }

  function listPasses(s) {
    let result = String(s);
    for (;;) {
      const m = /<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>/i.exec(result);
      if (!m) return result;
      const tag = m[1].toLowerCase();
      const closeIdx = findCloseIndex(result, m.index, tag);
      const inner = result.slice(m.index, closeIdx);
      result = result.slice(0, m.index) + listBlockToMarkdown(inner) + result.slice(closeIdx + m[0].length);
    }
  }

  function findCloseIndex(s, from, tag) {
    const re = new RegExp('<' + tag + '(?=[\\s>])|<\\/' + tag + '>', 'gi');
    re.lastIndex = from;
    let depth = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[0][1] === '/') { depth--; if (depth === 0) return m.index; }
      else depth++;
    }
    return s.length;
  }

  function listBlockToMarkdown(inner) {
    const tagM = /<(ul|ol)([\s>]*)>([\s\S]*?)<\/\1>/i.exec(inner);
    const ordered = !!tagM && /^<ol/i.test(tagM[0]);
    const innerS = tagM ? tagM[3] : inner;
    const liOpen = /<li[^>]*>/i;
    const found = [];
    let s2 = innerS;
    liOpen.lastIndex = 0;
    let m2;
    while ((m2 = liOpen.exec(s2)) !== null) {
      const openIdx = m2.index;
      const closeRe = /<\/li>/i;
      closeRe.lastIndex = openIdx + m2[0].length;
      const closeM = closeRe.exec(s2);
      const closeIdx = closeM ? closeM.index : s2.length - 5;
      found.push({ openIdx, closeIdx: closeIdx + 5, ordered: false });
      liOpen.lastIndex = closeIdx + 5;
    }
    const itemsList = found.map((f, i) => ({ ...f, idx: i }));
    const outLines = [];
    for (const f of found) {
      const content = innerS.slice(f.openIdx, f.closeIdx);
      const nested = listBlockToMarkdown(content);
      const text = inlineSimpleHtml(content).trim();
      const isOrdered = /^<ol/i.test(content);
      const marker = isOrdered ? String(f.idx + 1) + '. ' : "- ";
      const linesOut = [];
      if (text) linesOut.push(marker + text.replace(/\n/g, '\n  ').trim());
      const nestedLines = nested.split('\n').map(l => l.trim()).filter(l => l !== '');
      for (const l of nestedLines) linesOut.push('  ' + l);
      outLines.push(...linesOut);
    }
    let resultStr = outLines.join('\n');
    if (ordered) {
      let counter = 0;
      resultStr = outLines.map(l => { if (/^\s*\d+[.)]\s+/.test(l)) { counter++; return l.replace(/^\s*\d+[.)]\s+/, counter + '. '); } return l; }).join('\n');
    }
    return resultStr;
  }

  function inlinePass(s) {
    let out = String(s);
    out = out.replace(/<br\s*\/?>/gi, function () { return '  \n'; });
    out = out.replace(/<strong>([\s\S]*?)<\/strong>/gi, function (m, inner) { return '**' + inlinePass(inner) + '**'; });
    out = out.replace(/<b>([\s\S]*?)<\/b>/gi, function (m, inner) { return '**' + inlinePass(inner) + '**'; });
    out = out.replace(/<em>([\s\S]*?)<\/em>/gi, function (m, inner) { return '*' + inlinePass(inner) + '*'; });
    out = out.replace(/<i>([\s\S]*?)<\/i>/gi, function (m, inner) { return '*' + inlinePass(inner) + '*'; });
    out = out.replace(/<del>([\s\S]*?)<\/del>/gi, function (m, inner) { return '~~' + inlinePass(inner) + '~~'; });
    out = out.replace(/<s>([\s\S]*?)<\/s>/gi, function (m, inner) { return '~~' + inlinePass(inner) + '~~'; });
    out = out.replace(/<code>([\s\S]*?)<\/code>/gi, function (m, inner) { const t = inlineSimpleHtml(inner); return '`' + t.replace(/`/g, "'") + '`'; });
    out = out.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, function (m, href, inner) { const t = inlineSimpleHtml(inner); return '[' + t + '](' + href + ')'; });
    out = out.replace(/<a\s+href='([^']*)'[^>]*>([\s\S]*?)<\/a>/gi, function (m, href, inner) { const t = inlineSimpleHtml(inner); return '[' + t + '](' + href + ')'; });
    out = out.replace(/<img\s+src="([^"]*)"[^>]*>/gi, function (m, src) { const altM = /alt="([^"]*)"/i.exec(m); return '![' + (altM ? altM[1] : '') + '](' + src + ')'; });
    out = out.replace(/<img\s+src='([^']*)'[^>]*>/gi, function (m, src) { const altM = /alt=['"]([^'"]*)['"]/i.exec(m); return '![' + (altM ? altM[1] : '') + '](' + src + ')'; });
    out = out.replace(/<[^>]*>/g, '');
    out = decodeEntities(out);
    out = out.replace(/\n{3,}/g, '\n\n');
    return out;
  }

  function stripForWordCount(s) {
    return String(s)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[*_`>\[\]()|!#-]/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  }

  function markdownToHtmlPublic(md) { return markdownToHtml(md); }

  function htmlToMarkdownPublic(html) {
    let s = String(html);
    s = s.replace(/<!DOCTYPE[^>]*>/gi, '');
    const bm = /<body[^>]*>([\s\S]*)<\/body>/i.exec(s);
    if (bm) s = bm[1];
    s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, function (m, attrs, code) {
      const langM = /class="[^"]*language-([\w-]+)/i.exec(attrs || '');
      const decoded = decodeEntities(code).replace(/\n$/, '');
      const lang = langM ? langM[1] : '';
      const fence = '```' + (lang ? lang : '');
      return '\n' + fence + '\n' + decoded + '\n' + fence + '\n';
    });
    s = s.replace(/<hr[^>]*>/gi, '\n\n---\n\n');
    s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, function (m, lvl, inner) { return '\n' + '#'.repeat(Number(lvl)) + ' ' + renderInline(inlineSimpleHtml(inner)).trim() + '\n'; });
    s = s.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, function (m, inner) { return '\n' + htmlToMarkdownPublic(inner).split('\n').map(l => (l.trim() === '' ? '' : '> ' + l.trim())).filter(l => l !== '').join('\n') + '\n\n'; });
    s = listPasses(s);
    s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, function (m, inner) { const t = inlineSimpleHtml(inner).trim(); return t ? '\n' + t + '\n' : ''; });
    s = inlinePass(s);
    s = s.replace(/<[^>]*>/g, '');
    s = decodeEntities(s);
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim() + '\n';
  }

  function htmlToMarkdown(html) { return htmlToMarkdownPublic(html); }

  function wordCount(md) {
    const words = stripForWordCount(md).trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  return {
    markdownToHtml: markdownToHtmlPublic,
    htmlToMarkdown: htmlToMarkdown,
    wordCount: wordCount
  };
});
