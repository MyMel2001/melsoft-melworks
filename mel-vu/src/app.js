// MelVU Studio Client Application Engine

let mvDoc = null;
let mvLanguage = 'html';
let mvFileName = 'untitled.html';
let mvDirty = false;

function mvDocText() {
  return mvDoc ? mvDoc.getText() : '';
}

function updateStatus(message) {
  const statusEl = document.getElementById('melvu-status');
  if (statusEl) statusEl.textContent = message || 'MelVU | No document open';
}

function updateLang() {
  const langEl = document.getElementById('melvu-lang');
  if (langEl) langEl.textContent = String(mvLanguage || 'html').toUpperCase();
}

function melvuPreviewBaseStyle() {
  return 'body{font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:16px;margin:0;}h1,h2,h3{color:#38bdf8;}code{background:#0f172a;padding:2px 6px;border-radius:4px;}';
}

function buildPreviewDoc() {
  const html = mvDocText();
  const baseStyle = melvuPreviewBaseStyle();
  if (mvLanguage === 'markdown') {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + baseStyle + '</style></head><body>' + window.MelMarkdown.markdownToHtml(html) + '</body></html>';
  }
  if (mvLanguage === 'css') {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + baseStyle + '</style><style>' + html + '</style></head><body><div class="melvu-preview-root"></div></body></html>';
  }
  if (/^\s*</.test(html) && /<\s*html[\s>]/i.test(html)) {
    const content = html
      .replace(/<\s*!doctype[^>]*>/gi, '')
      .replace(/<\s*html[^>]*>/gi, '')
      .replace(/<\s*head[^>]*>[\s\S]*?<\s*\/\s*head\s*>/gi, '')
      .replace(/<\s*\/\s*html\s*>/gi, '');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + baseStyle + '</style></head><body>' + content + '</body></html>';
  }
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + baseStyle + '</style></head><body>' + html + '</body></html>';
}

function updatePreview() {
  const frame = document.getElementById('melvu-preview');
  if (!frame) return;
  frame.srcdoc = buildPreviewDoc();
}

function setDoc(text, language, fileName) {
  mvLanguage = language || 'html';
  mvFileName = fileName || 'untitled.html';
  mvDoc = new window.MelEditor.EditorDoc(text, mvLanguage);
  const editorEl = document.getElementById('melvu-editor');
  if (editorEl) {
    editorEl.value = text;
    editorEl.dataset.language = mvLanguage;
  }
  updatePreview();
  updateLang();
  updateStatus('MelVU | ' + mvFileName);
}

function defaultDocText() {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Untitled</title>\n</head>\n<body>\n  <h1>Hello MelVU</h1>\n</body>\n</html>\n';
}

function melvuNewFile() {
  setDoc(defaultDocText(), 'html', 'untitled.html');
}

function triggerMelvuOpen() {
  const input = document.getElementById('melvu-file-input');
  if (input) input.click();
}

function handleMelvuFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    const text = String(reader.result || '');
    const language = window.MelEditor.detectLanguage(file.name) || 'html';
    setDoc(text, language, file.name);
  };
  reader.readAsText(file);
}

function triggerMelvuSaveAs() {
  const input = document.getElementById('melvu-save-input');
  if (input) input.click();
}

function handleMelvuSaveAs(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const fs = (typeof require === 'function') ? require('fs') : null;
  if (!fs) {
    window.alert('MelVU Save As requires a file system.');
    return;
  }
  fs.writeFileSync(file.path || file.name, mvDocText());
  mvFileName = file.name;
  mvDirty = false;
  updateStatus('MelVU | Saved ' + mvFileName);
}

function melvuSaveFile() {
  const fs = (typeof require === 'function') ? require('fs') : null;
  if (!fs) {
    window.alert('MelVU Save requires a file system.');
    return;
  }
  if (!mvFileName || mvFileName === 'untitled.html') {
    const input = document.getElementById('melvu-save-input');
    if (input) input.click();
    return;
  }
  fs.writeFileSync(mvFileName, mvDocText());
  mvDirty = false;
  updateStatus('MelVU | Saved ' + mvFileName);
}

function mvCursorLine() {
  const editorEl = document.getElementById('melvu-editor');
  const offset = editorEl ? (editorEl.selectionStart || 0) : 0;
  const pos = mvDoc.offsetToPosition(offset);
  return pos.line;
}

function syncEditorFromDoc() {
  const editorEl = document.getElementById('melvu-editor');
  const text = mvDoc ? mvDoc.getText() : '';
  if (editorEl) editorEl.value = text;
  return editorEl;
}

function melvuEditorAction(action) {
  if (!mvDoc) {
    updateStatus('MelVU | No document open');
    return;
  }
  const text = mvDoc.getText();
  if (action === 'undo') {
    const ok = mvDoc.undo();
    syncEditorFromDoc();
    updatePreview();
    updateStatus('MelVU | Undo ' + (ok ? 'ok' : 'nothing to undo'));
    return;
  }
  if (action === 'redo') {
    const ok = mvDoc.redo();
    syncEditorFromDoc();
    updatePreview();
    updateStatus('MelVU | Redo ' + (ok ? 'ok' : 'nothing to redo'));
    return;
  }
  if (action === 'format') {
    const formatted = window.MelEditor.formatDocument(text, mvLanguage);
    mvDoc.setText(formatted);
    syncEditorFromDoc();
    updatePreview();
    updateStatus('MelVU | Formatted ' + String(mvLanguage).toUpperCase());
    return;
  }
  if (action === 'toggleComment') {
    const pos = mvDoc.positionToOffset({ line: mvCursorLine(), column: 1 });
    const out = window.MelEditor.toggleComment(mvDoc.getText(), pos, mvLanguage);
    mvDoc.setText(out);
    syncEditorFromDoc();
    updatePreview();
    updateStatus('MelVU | Toggled comment');
    return;
  }
  if (action === 'find') {
    const query = window.prompt('Find');
    if (query === null) return;
    const results = window.MelEditor.find(text, query, { regex: false });
    updateStatus('MelVU | Find "' + query + '": ' + results.length + ' match(es)');
    return;
  }
  if (action === 'replace') {
    const query = window.prompt('Find');
    if (query === null) return;
    const replacement = window.prompt('Replace with');
    if (replacement === null) return;
    const next = window.MelEditor.replaceAll(text, query, replacement, { regex: false });
    mvDoc.setText(next);
    syncEditorFromDoc();
    updatePreview();
    updateStatus('MelVU | Replaced occurrences of "' + query + '"');
    return;
  }
  if (action === 'gotoLine') {
    const raw = window.prompt('Go to line');
    const line = parseInt(raw, 10);
    if (!line || line < 1) {
      updateStatus('MelVU | Invalid line number');
      return;
    }
    const offset = mvDoc.positionToOffset({ line: line, column: 1 });
    const editorEl = document.getElementById('melvu-editor');
    if (editorEl) {
      editorEl.focus();
      editorEl.setSelectionRange(offset, offset);
    }
    updateStatus('MelVU | Line ' + line);
    return;
  }
  updateStatus('MelVU | Unknown editor action: ' + action);
}

function melvuTogglePanels() {
  const workspace = document.getElementById('melvu-workspace');
  if (workspace) workspace.classList.toggle('melvu-hidden');
}

function melvuAbout() {
  window.alert('MelVU - Visual Web Studio\nHTML visual editing, DreamWeaver-class CSS, VSCode-class code editing.');
}

function onMelvuEditorInput() {
  if (!mvDoc) return;
  mvDoc.setText(document.getElementById('melvu-editor').value);
  mvDirty = true;
  updatePreview();
}

document.addEventListener('DOMContentLoaded', function () {
  setDoc(defaultDocText(), 'html', 'untitled.html');
  const editorEl = document.getElementById('melvu-editor');
  if (editorEl) {
    editorEl.addEventListener('input', onMelvuEditorInput);
    editorEl.addEventListener('change', onMelvuEditorInput);
  }
});
