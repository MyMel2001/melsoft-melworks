// MelOffice 365 Professional Client Application Engine
const DocxDocument = require('./docx');
const XlsxSpreadsheet = require('./xlsx');
const PptxPresentation = require('./pptx');
const { MelPdfDocument, StandardFonts } = require('./pdf');

let currentApp = 'word'; // 'word', 'excel', 'ppt', 'pdf'
let currentRibbonTab = 'home';

// --- MelWord State ---
let wordRulerActive = true;
let currentWordBorder = 'none';

// --- MelExcel State ---
const EXCEL_COLS = 26; // A to Z
const EXCEL_ROWS = 50;
let currentSheetName = 'Sheet1';
let excelSheets = {
  'Sheet1': {}
};
let selectedCell = 'A1';
let rangeStart = null;
let rangeEnd = null;
let isDraggingRange = false;

// --- MelPowerPoint State ---
let pptSlides = [
  {
    layout: 'title',
    title: 'MelOffice Presentation',
    subtitle: 'ECMA-376 PresentationML Slide Deck',
    body: '<p>• Full native support for PresentationML (pml.xsd)</p><p>• Dynamic multi-slide presentation manager</p><p>• Export directly to MelSlideshows .pptx files</p>',
    notes: 'Speaker notes: Welcome audience to MelOffice PresentationML engine.',
    bg: '#ffffff'
  },
  {
    layout: 'content',
    title: 'Next Generation Architecture',
    subtitle: 'Built on NodeJS and Open Standards',
    body: '<p>• Zero heavy runtime dependencies</p><p>• Native Open Packaging Conventions (OPC) packaging</p><p>• High-performance cross-platform support</p>',
    notes: 'Highlight performance and pure JavaScript implementation.',
    bg: '#ffffff'
  }
];
let currentSlideIndex = 0;
let slideShowIndex = 0;

// --- MelPDF State ---
let currentPdfFile = { name: 'Untitled.pdf', dataUrl: '' };

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  initExcelGrid();
  loadSampleExcelData();
  renderPptDeck();
  initWordRuler();
  handleWordInput();
  updateStatus();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      if (currentApp === 'ppt') startSlideShow();
    }
  });
});

// --- App Switching ---
function switchApp(app) {
  currentApp = app;

  const titlebar = document.getElementById('titlebar');
  const brandIcon = document.getElementById('brand-icon');
  const brandText = document.getElementById('brand-text');

  document.querySelectorAll('.app-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-switch-${app}`).classList.add('active');

  titlebar.className = 'titlebar';
  if (app === 'excel') titlebar.classList.add('excel-theme');
  if (app === 'ppt') titlebar.classList.add('ppt-theme');
  if (app === 'pdf') titlebar.classList.remove('excel-theme');
  if (app === 'pdf') titlebar.classList.remove('ppt-theme');

  const appMeta = {
    word: { icon: 'D', text: 'MelDocs - Document1' },
    excel: { icon: 'X', text: 'MelXL - Book1' },
    ppt: { icon: 'S', text: 'MelSlideshows - Presentation1' },
    pdf: { icon: 'P', text: 'MelPDF - Document.pdf' }
  };

  brandIcon.textContent = appMeta[app].icon;
  brandText.textContent = appMeta[app].text;

  // Workspaces
  document.getElementById('word-workspace').style.display = (app === 'word') ? 'flex' : 'none';
  document.getElementById('excel-container').style.display = (app === 'excel') ? 'flex' : 'none';
  document.getElementById('ppt-container').style.display = (app === 'ppt') ? 'flex' : 'none';
  document.getElementById('pdf-container').style.display = (app === 'pdf') ? 'flex' : 'none';

  // Ribbon tabs visibility
  document.getElementById('tab-formulas').style.display = (app === 'excel') ? 'block' : 'none';

  // Ribbon contextual tool groups
  document.getElementById('group-text-formatting').style.display = (app === 'excel') ? 'none' : 'inline-flex';
  document.getElementById('group-alignment').style.display = (app === 'word') ? 'inline-flex' : 'none';
  document.getElementById('group-word-styles').style.display = (app === 'word') ? 'inline-flex' : 'none';
  document.getElementById('group-word-art-borders').style.display = (app === 'word') ? 'inline-flex' : 'none';
  document.getElementById('group-excel-quick').style.display = (app === 'excel') ? 'inline-flex' : 'none';
  document.getElementById('group-ppt-quick').style.display = (app === 'ppt') ? 'inline-flex' : 'none';
  document.getElementById('group-ppt-bg').style.display = (app === 'ppt') ? 'inline-flex' : 'none';

  updateStatus();
}

function switchRibbonTab(tabName, event) {
  currentRibbonTab = tabName;
  document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ribbon-content').forEach(c => c.style.display = 'none');

  if (event && event.target) {
    event.target.classList.add('active');
  }

  const targetContent = document.getElementById(`ribbon-${tabName}`);
  if (targetContent) targetContent.style.display = 'flex';
}

// --- MelWord Engine ---
function initWordRuler() {
  const rulerTicks = document.getElementById('ruler-ticks');
  if (!rulerTicks) return;
  rulerTicks.innerHTML = '';
  // 8.5 inches with inch markers
  for (let i = 1; i <= 8; i++) {
    const mark = document.createElement('span');
    mark.style.cssText = `position:absolute; left:${i * 96}px; top:2px; font-size:9px;`;
    mark.textContent = i;
    rulerTicks.appendChild(mark);
  }
}

function handleWordInput() {
  const text = document.getElementById('doc-canvas').innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  document.getElementById('status-mid').textContent = `Page 1 of 1 | ${words} words | ${chars} characters`;
}

function formatDoc(cmd, val = null) {
  document.execCommand(cmd, false, val);
  document.getElementById('doc-canvas').focus();
  handleWordInput();
}

function growFont() {
  formatDoc('fontSize', '4');
}

function shrinkFont() {
  formatDoc('fontSize', '2');
}

function applyHeadingStyle(tag) {
  document.execCommand('formatBlock', false, `<${tag}>`);
  document.getElementById('doc-canvas').focus();
  handleWordInput();
}

function applyArtBorder(borderName) {
  const canvas = document.getElementById('doc-canvas');
  canvas.classList.remove('art-border-woodwork', 'art-border-zanyTriangles', 'art-border-zigZag');
  if (borderName !== 'none') {
    canvas.classList.add(`art-border-${borderName}`);
  }
  currentWordBorder = borderName;
}

function insertTableDialog() {
  const rows = prompt('Number of rows:', '3') || 3;
  const cols = prompt('Number of columns:', '3') || 3;
  let html = `<table border="1" style="width:100%; border-collapse:collapse; border-color:#cbd5e1; margin:12px 0;"><tbody>`;
  for (let r = 0; r < rows; r++) {
    html += `<tr>`;
    for (let c = 0; c < cols; c++) {
      html += `<td style="padding:8px; border:1px solid #cbd5e1;">Cell</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table><br>`;
  document.execCommand('insertHTML', false, html);
  handleWordInput();
}

function insertPageBreak() {
  const html = `<hr style="page-break-before:always; border:1px dashed #94a3b8; margin:24px 0;"><br>`;
  document.execCommand('insertHTML', false, html);
}

function insertShape(type) {
  let shapeHtml = '';
  if (type === 'rectangle') {
    shapeHtml = `<div style="width:140px; height:80px; background:#e0f2fe; border:2px solid #0284c7; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; margin:8px; user-select:none;">Shape</div>`;
  } else if (type === 'circle') {
    shapeHtml = `<div style="width:90px; height:90px; background:#fee2e2; border:2px solid #ef4444; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; margin:8px; user-select:none;">Circle</div>`;
  } else if (type === 'arrow') {
    shapeHtml = `<div style="font-size:36px; color:#2563eb; display:inline-block; margin:8px;">➔</div>`;
  } else if (type === 'star') {
    shapeHtml = `<div style="font-size:36px; color:#f59e0b; display:inline-block; margin:8px;">★</div>`;
  }
  document.execCommand('insertHTML', false, shapeHtml);
}

function insertTextBox() {
  const boxHtml = `<div style="width:200px; min-height:80px; border:1px solid #94a3b8; padding:8px; margin:8px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><p>Text box content...</p></div>`;
  document.execCommand('insertHTML', false, boxHtml);
}

function insertImagePrompt() {
  const url = prompt('Enter Image URL (or data URI):', 'https://via.placeholder.com/300x180.png?text=MelOffice+Image');
  if (!url) return;
  if (currentApp === 'ppt') {
    saveCurrentSlide();
    const slide = pptSlides[currentSlideIndex];
    if (slide) {
      slide.body = `<img src="${url}" alt="Inserted image" style="max-width:100%; max-height:60vh; display:block; margin:8px auto;">`;
      document.getElementById('slide-body').innerHTML = slide.body;
    }
    return;
  }
  document.execCommand('insertImage', false, url);
}

function changePageMargins(type) {
  const canvas = document.getElementById('doc-canvas');
  if (type === 'narrow') canvas.style.padding = '36px 48px';
  else if (type === 'wide') canvas.style.padding = '120px 140px';
  else canvas.style.padding = '72px 96px';
}

function changePageOrientation(type) {
  const canvas = document.getElementById('doc-canvas');
  if (type === 'landscape') {
    canvas.style.width = '1056px';
    canvas.style.minHeight = '816px';
  } else {
    canvas.style.width = '816px';
    canvas.style.minHeight = '1056px';
  }
}

// Find & Replace
function toggleFindReplace() {
  const bar = document.getElementById('find-replace-bar');
  bar.style.display = (bar.style.display === 'none') ? 'flex' : 'none';
  if (bar.style.display === 'flex') document.getElementById('find-input').focus();
}

function performFindNext() {
  const text = document.getElementById('find-input').value;
  if (text) window.find(text, false, false, true, false, false, false);
}

function performReplace() {
  const findVal = document.getElementById('find-input').value;
  const repVal = document.getElementById('replace-input').value;
  if (!findVal) return;
  const sel = window.getSelection();
  if (sel && sel.toString().toLowerCase() === findVal.toLowerCase()) {
    document.execCommand('insertText', false, repVal);
  }
  performFindNext();
}

function performReplaceAll() {
  const findVal = document.getElementById('find-input').value;
  const repVal = document.getElementById('replace-input').value;
  if (!findVal) return;
  const canvas = document.getElementById('doc-canvas');
  const regex = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  canvas.innerHTML = canvas.innerHTML.replace(regex, repVal);
  handleWordInput();
}

function showWordCountModal() {
  const text = document.getElementById('doc-canvas').innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const lines = text.split(/\r\n|\r|\n/).length;
  alert(`Word Count Statistics:\n\nWords: ${words}\nCharacters: ${chars}\nParagraphs/Lines: ${lines}`);
}

function toggleSpellCheck() {
  const canvas = document.getElementById('doc-canvas');
  canvas.spellcheck = !canvas.spellcheck;
  alert(`Spellcheck is now ${canvas.spellcheck ? 'Enabled' : 'Disabled'}.`);
}

function toggleRuler() {
  const ruler = document.getElementById('word-ruler');
  wordRulerActive = !wordRulerActive;
  ruler.style.display = wordRulerActive ? 'flex' : 'none';
}

function toggleGridlines() {
  const table = document.getElementById('excel-table');
  table.style.border = (table.style.border === 'none') ? '1px solid #d1d5db' : 'none';
}

function setDocZoom(pct) {
  const canvas = document.getElementById('doc-canvas');
  canvas.style.transformOrigin = 'top center';
  canvas.style.transform = `scale(${pct / 100})`;
}

// --- MelExcel Engine ---
function colName(index) {
  return String.fromCharCode(65 + index);
}

function initExcelGrid() {
  const table = document.getElementById('excel-table');
  table.innerHTML = '';

  // Header Row
  const headerTr = document.createElement('tr');
  const thCorner = document.createElement('th');
  thCorner.textContent = '';
  headerTr.appendChild(thCorner);

  for (let c = 0; c < EXCEL_COLS; c++) {
    const th = document.createElement('th');
    th.textContent = colName(c);
    headerTr.appendChild(th);
  }
  table.appendChild(headerTr);

  // Data Rows
  for (let r = 1; r <= EXCEL_ROWS; r++) {
    const tr = document.createElement('tr');
    const tdNum = document.createElement('td');
    tdNum.className = 'row-num';
    tdNum.textContent = r;
    tr.appendChild(tdNum);

    for (let c = 0; c < EXCEL_COLS; c++) {
      const coord = `${colName(c)}${r}`;
      const td = document.createElement('td');
      td.id = `cell-${coord}`;
      td.contentEditable = 'true';
      td.spellcheck = false;

      td.addEventListener('mousedown', (e) => {
        selectCell(coord);
        isDraggingRange = true;
        rangeStart = coord;
        rangeEnd = coord;
      });

      td.addEventListener('mouseenter', (e) => {
        if (isDraggingRange) {
          rangeEnd = coord;
          highlightRange(rangeStart, rangeEnd);
        }
      });

      td.addEventListener('blur', () => {
        commitCellFromGrid(coord);
      });

      td.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          td.blur();
          // Move down
          const nextRow = r + 1;
          if (nextRow <= EXCEL_ROWS) selectCell(`${colName(c)}${nextRow}`);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          td.blur();
          // Move right
          const nextCol = c + 1;
          if (nextCol < EXCEL_COLS) selectCell(`${colName(nextCol)}${r}`);
        }
      });

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  window.addEventListener('mouseup', () => {
    isDraggingRange = false;
  });
}

function loadSampleExcelData() {
  excelSheets['Sheet1'] = {
    'A1': { value: 'Software Solution', formula: '' },
    'B1': { value: 'Licenses Sold', formula: '' },
    'C1': { value: 'Price / Unit ($)', formula: '' },
    'D1': { value: 'Subtotal ($)', formula: '' },
    'A2': { value: 'MelOffice 365 Pro', formula: '' },
    'B2': { value: '120', formula: '' },
    'C2': { value: '249.99', formula: '' },
    'D2': { value: '', formula: '=B2*C2' },
    'A3': { value: 'MelDraw Studio', formula: '' },
    'B3': { value: '85', formula: '' },
    'C3': { value: '199.99', formula: '' },
    'D3': { value: '', formula: '=B3*C3' },
    'A4': { value: 'MelCromedia Pro', formula: '' },
    'B4': { value: '64', formula: '' },
    'C4': { value: '149.99', formula: '' },
    'D4': { value: '', formula: '=B4*C4' },
    'A5': { value: 'MelCAD 2026', formula: '' },
    'B5': { value: '40', formula: '' },
    'C5': { value: '799.99', formula: '' },
    'D5': { value: '', formula: '=B5*C5' },
    'A6': { value: 'TOTAL REVENUE', formula: '' },
    'D6': { value: '', formula: '=SUM(D2:D5)' }
  };
  recalcExcelGrid();
}

function selectCell(coord) {
  selectedCell = coord;
  document.querySelectorAll('.excel-grid td').forEach(td => {
    td.classList.remove('selected', 'range-selected');
  });
  const td = document.getElementById(`cell-${coord}`);
  if (td) td.classList.add('selected');

  document.getElementById('selected-cell-id').value = coord;
  const curData = excelSheets[currentSheetName] || {};
  const cell = curData[coord] || { value: '', formula: '' };
  document.getElementById('fx-bar').value = cell.formula ? cell.formula : cell.value;

  updateExcelStats([coord]);
}

function highlightRange(start, end) {
  const range = parseRange(start, end);
  document.querySelectorAll('.excel-grid td').forEach(td => td.classList.remove('range-selected'));
  for (const c of range) {
    const td = document.getElementById(`cell-${c}`);
    if (td) td.classList.add('range-selected');
  }
  document.getElementById('selected-cell-id').value = `${start}:${end}`;
  updateExcelStats(range);
}

function updateExcelStats(coords) {
  const curData = excelSheets[currentSheetName] || {};
  let sum = 0, count = 0, numCount = 0;
  for (const c of coords) {
    const td = document.getElementById(`cell-${c}`);
    if (td && td.textContent.trim()) {
      count++;
      const val = parseFloat(td.textContent.replace(/[$,%]/g, ''));
      if (!isNaN(val)) {
        sum += val;
        numCount++;
      }
    }
  }

  if (numCount > 0) {
    const avg = sum / numCount;
    document.getElementById('status-mid').textContent = `Average: ${avg.toFixed(2)} | Count: ${count} | Sum: ${sum.toFixed(2)}`;
  } else {
    document.getElementById('status-mid').textContent = `Count: ${count}`;
  }
}

function commitCellFromGrid(coord) {
  const td = document.getElementById(`cell-${coord}`);
  if (!td) return;
  const text = td.textContent.trim();
  if (!excelSheets[currentSheetName]) excelSheets[currentSheetName] = {};

  if (text.startsWith('=')) {
    excelSheets[currentSheetName][coord] = { value: '', formula: text };
  } else {
    excelSheets[currentSheetName][coord] = { value: text, formula: '' };
  }
  recalcExcelGrid();
}

function handleFxKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    acceptFxEdit();
  } else if (event.key === 'Escape') {
    cancelFxEdit();
  }
}

function handleFxInput(event) {
  const val = event.target.value;
  const td = document.getElementById(`cell-${selectedCell}`);
  if (td) td.textContent = val;
}

function acceptFxEdit() {
  const val = document.getElementById('fx-bar').value.trim();
  if (!excelSheets[currentSheetName]) excelSheets[currentSheetName] = {};

  if (val.startsWith('=')) {
    excelSheets[currentSheetName][selectedCell] = { value: '', formula: val };
  } else {
    excelSheets[currentSheetName][selectedCell] = { val, formula: '' };
  }
  recalcExcelGrid();
  const td = document.getElementById(`cell-${selectedCell}`);
  if (td) td.focus();
}

function cancelFxEdit() {
  const curData = excelSheets[currentSheetName] || {};
  const cell = curData[selectedCell] || { value: '', formula: '' };
  document.getElementById('fx-bar').value = cell.formula ? cell.formula : cell.value;
  recalcExcelGrid();
}

function promptFunctionDialog() {
  const func = prompt('Enter formula function (SUM, AVERAGE, MIN, MAX, COUNT, IF, PRODUCT, LOOKUP, ABS, ROUND):', 'SUM');
  if (func) {
    insertFormulaTemplate(func.toUpperCase());
  }
}

function insertFormulaTemplate(func) {
  let template = `=${func}(A1:A5)`;
  if (func === 'IF') template = `=IF(A1>50, "PASS", "FAIL")`;
  if (func === 'PRODUCT') template = `=PRODUCT(A1:A5)`;
  document.getElementById('fx-bar').value = template;
  acceptFxEdit();
}

function applyExcelFormat(type) {
  const td = document.getElementById(`cell-${selectedCell}`);
  if (!td) return;
  const cur = parseFloat(td.textContent.replace(/[$,%]/g, '')) || 0;
  if (type === 'currency') td.textContent = `$${cur.toFixed(2)}`;
  if (type === 'percent') td.textContent = `${(cur * 100).toFixed(1)}%`;
  if (type === 'comma') td.textContent = cur.toLocaleString('en-US', { minimumFractionDigits: 2 });
  if (type === 'decimals-inc') td.textContent = cur.toFixed(3);
  if (type === 'decimals-dec') td.textContent = cur.toFixed(1);
}

function setCellBorder(type) {
  const td = document.getElementById(`cell-${selectedCell}`);
  if (!td) return;
  if (type === 'all') td.style.border = '2px solid #000';
  else if (type === 'outside') td.style.outline = '2px solid #000';
  else td.style.border = '1px solid #d1d5db';
}

function setCellFill(color) {
  const td = document.getElementById(`cell-${selectedCell}`);
  if (td) td.style.backgroundColor = color;
}

function mergeSelectedCells() {
  const td = document.getElementById(`cell-${selectedCell}`);
  if (td) {
    td.colSpan = 2;
    td.style.textAlign = 'center';
    td.style.fontWeight = 'bold';
  }
}

// Multi-Sheet Tabs
function switchSheet(sheetName, event) {
  currentSheetName = sheetName;
  document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
  if (event && event.target && event.target.classList) event.target.classList.add('active');
  recalcExcelGrid();
  selectCell('A1');
}

function addNewSheet() {
  const newName = `Sheet${Object.keys(excelSheets).length + 1}`;
  excelSheets[newName] = {};

  const tabsList = document.getElementById('sheet-tabs-list');
  const tab = document.createElement('div');
  tab.className = 'sheet-tab';
  tab.textContent = newName;
  tab.onclick = (e) => switchSheet(newName);
  tabsList.appendChild(tab);

  switchSheet(newName);
}

function parseRange(start, end) {
  const col1 = start.charCodeAt(0) - 65;
  const row1 = parseInt(start.substring(1), 10);
  const col2 = end.charCodeAt(0) - 65;
  const row2 = parseInt(end.substring(1), 10);

  const minC = Math.min(col1, col2);
  const maxC = Math.max(col1, col2);
  const minR = Math.min(row1, row2);
  const maxR = Math.max(row1, row2);

  const list = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      list.push(`${colName(c)}${r}`);
    }
  }
  return list;
}

function evaluateFormulaBrowser(expr, visited = new Set()) {
  if (!expr) return 0;
  let formula = expr.trim();
  if (formula.startsWith('=')) formula = formula.substring(1).trim();

  // SUM(A1:A5)
  const sumMatch = formula.match(/^SUM\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
  if (sumMatch) {
    const range = parseRange(sumMatch[1], sumMatch[2]);
    let total = 0;
    for (const c of range) {
      total += Number(getCellValueBrowser(c, visited)) || 0;
    }
    return total;
  }

  // AVERAGE(A1:A5)
  const avgMatch = formula.match(/^AVERAGE\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
  if (avgMatch) {
    const range = parseRange(avgMatch[1], avgMatch[2]);
    let total = 0, count = 0;
    for (const c of range) {
      const v = getCellValueBrowser(c, visited);
      if (v !== '' && !isNaN(Number(v))) {
        total += Number(v);
        count++;
      }
    }
    return count > 0 ? (total / count).toFixed(2) : 0;
  }

  // MIN / MAX / COUNT
  const minMatch = formula.match(/^MIN\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
  if (minMatch) {
    const range = parseRange(minMatch[1], minMatch[2]);
    let minVal = Infinity;
    for (const c of range) {
      const v = Number(getCellValueBrowser(c, visited));
      if (!isNaN(v) && v < minVal) minVal = v;
    }
    return isFinite(minVal) ? minVal : 0;
  }

  const maxMatch = formula.match(/^MAX\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
  if (maxMatch) {
    const range = parseRange(maxMatch[1], maxMatch[2]);
    let maxVal = -Infinity;
    for (const c of range) {
      const v = Number(getCellValueBrowser(c, visited));
      if (!isNaN(v) && v > maxVal) maxVal = v;
    }
    return isFinite(maxVal) ? maxVal : 0;
  }

  const countMatch = formula.match(/^COUNT\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
  if (countMatch) {
    const range = parseRange(countMatch[1], countMatch[2]);
    let count = 0;
    for (const c of range) {
      const v = getCellValueBrowser(c, visited);
      if (v !== '' && !isNaN(Number(v))) count++;
    }
    return count;
  }

  // IF(cond, trueVal, falseVal)
  const ifMatch = formula.match(/^IF\(([\s\S]*?),\s*([\s\S]*?),\s*([\s\S]*)\)$/i);
  if (ifMatch) {
    const shouldPass = evaluateConditionBrowser(ifMatch[1].trim(), visited);
    const branch = (shouldPass ? ifMatch[2] : ifMatch[3]).trim();
    let value = branch;
    if (/^".*"$/.test(branch)) return branch.slice(1, -1);
    const num = Number(value);
    if (value !== '' && !isNaN(num)) return num;
    const cellVal = getCellValueBrowser(value, visited);
    const cellNum = Number(cellVal);
    return isNaN(cellNum) ? cellVal : cellNum;
  }

  // PRODUCT(range)
  const prodMatch = formula.match(/^PRODUCT\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
  if (prodMatch) {
    const range = parseRange(prodMatch[1], prodMatch[2]);
    let prod = 1;
    for (const c of range) {
      prod *= Number(getCellValueBrowser(c, visited)) || 0;
    }
    return prod;
  }

  // ABS(x)
  const absMatch = formula.match(/^ABS\(([\s\S]*)\)$/i);
  if (absMatch) {
    const val = Number(evaluateFormulaBrowser(absMatch[1], visited)) || 0;
    return Math.abs(val);
  }

  // ROUND(x, digits)
  const roundMatch = formula.match(/^ROUND\(([\s\S]*?),\s*([\s\S]*)\)$/i);
  if (roundMatch) {
    const val = Number(evaluateFormulaBrowser(roundMatch[1], visited)) || 0;
    const digits = roundMatch[2].trim() === '' ? 0 : parseInt(evaluateFormulaBrowser(roundMatch[2], visited), 10) || 0;
    const factor = Math.pow(10, digits);
    return Math.round(val * factor) / factor;
  }

  // Math expression like B2*C2
  const replaced = formula.replace(/[A-Z]+[0-9]+/gi, (m) => {
    return Number(getCellValueBrowser(m.toUpperCase(), visited)) || 0;
  });

  try {
    if (/^[0-9\.\+\-\*\/\(\)\s]+$/.test(replaced)) {
      const res = Function(`"use strict"; return (${replaced});`)();
      return typeof res === 'number' ? Math.round(res * 100) / 100 : res;
    }
  } catch (e) {
    return '#VALUE!';
  }

  return '#ERROR';
}

function getCellValueBrowser(coord, visited = new Set()) {
  if (visited.has(coord)) return '#CIRCULAR!';
  visited.add(coord);
  const curData = excelSheets[currentSheetName] || {};
  const cell = curData[coord];
  if (!cell) return '';
  if (cell.formula) {
    return evaluateFormulaBrowser(cell.formula, visited);
  }
  return cell.value;
}

function evaluateConditionBrowser(cond, visited = new Set()) {
  let c = cond.trim().toUpperCase();
  c = c.replace(/[A-Z]+[0-9]+/g, (m) => {
    const v = Number(getCellValueBrowser(m, visited)) || 0;
    return String(v);
  });
  const cm = c.match(/^(.+?)(>=|<=|=|>|<)\s*(.+)$/);
  if (!cm) return true;
  const left = Number(cm[1]);
  const right = Number(cm[3]);
  const op = cm[2];
  if (op === '>=') return left >= right;
  if (op === '<=') return left <= right;
  if (op === '=') return left === right;
  if (op === '>') return left > right;
  if (op === '<') return left < right;
  return true;
}

function recalcExcelGrid() {
  const curData = excelSheets[currentSheetName] || {};
  for (let r = 1; r <= EXCEL_ROWS; r++) {
    for (let c = 0; c < EXCEL_COLS; c++) {
      const coord = `${colName(c)}${r}`;
      const td = document.getElementById(`cell-${coord}`);
      if (!td) continue;
      const cell = curData[coord];
      if (cell) {
        if (cell.formula) {
          td.textContent = evaluateFormulaBrowser(cell.formula);
        } else {
          td.textContent = cell.value;
        }
      } else {
        td.textContent = '';
      }
    }
  }
  updateStatus();
}

// --- MelPowerPoint Engine ---
function renderPptDeck() {
  const deck = document.getElementById('ppt-deck');
  deck.innerHTML = '';

  pptSlides.forEach((slide, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `slide-thumb ${idx === currentSlideIndex ? 'active' : ''}`;
    thumb.innerHTML = `
      <span class="slide-thumb-num">${idx + 1}</span>
      <strong style="max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${slide.title || ''}</strong>
      <div style="font-size:9px; margin-top:2px; opacity:0.7;">${slide.layout || 'Slide'}</div>
    `;
    thumb.onclick = () => selectSlide(idx);
    deck.appendChild(thumb);
  });

  loadCurrentSlide();
}

function selectSlide(index) {
  saveCurrentSlide();
  currentSlideIndex = index;
  renderPptDeck();
}

function saveCurrentSlide() {
  if (pptSlides[currentSlideIndex]) {
    pptSlides[currentSlideIndex].title = document.getElementById('slide-title').innerText;
    pptSlides[currentSlideIndex].subtitle = document.getElementById('slide-subtitle').innerText;
    pptSlides[currentSlideIndex].body = document.getElementById('slide-body').innerHTML;
    pptSlides[currentSlideIndex].notes = document.getElementById('slide-notes').value;
  }
}

function loadCurrentSlide() {
  const slide = pptSlides[currentSlideIndex];
  if (!slide) return;
  document.getElementById('slide-title').innerText = slide.title || '';
  document.getElementById('slide-subtitle').innerText = slide.subtitle || '';
  document.getElementById('slide-body').innerHTML = slide.body || '';
  document.getElementById('slide-notes').value = slide.notes || '';
  document.getElementById('slide-stage').style.backgroundColor = slide.bg || '#ffffff';

  const titleEl = document.getElementById('slide-title');
  if (titleEl) {
    if (slide.titleSize) titleEl.style.fontSize = `${slide.titleSize}px`;
    if (slide.titleBold) titleEl.style.fontWeight = '700';
  }
  const subtitleEl = document.getElementById('slide-subtitle');
  if (subtitleEl) {
    if (slide.subtitleSize) subtitleEl.style.fontSize = `${slide.subtitleSize}px`;
  }
}

function promptAddSlide() {
  const layout = prompt('Select Slide Layout (title, content, twocontent, blank):', 'content') || 'content';
  saveCurrentSlide();

  let body = '<p>• Add bullet points here</p>';
  if (layout === 'twocontent') {
    body = `<div style="display:flex; gap:20px;"><div style="flex:1;"><p>• Column 1 Point</p></div><div style="flex:1;"><p>• Column 2 Point</p></div></div>`;
  } else if (layout === 'blank') {
    body = '';
  }

  pptSlides.push({
    layout,
    title: `Slide ${pptSlides.length + 1}`,
    subtitle: 'Subtitle text',
    body,
    notes: '',
    bg: '#ffffff'
  });
  currentSlideIndex = pptSlides.length - 1;
  renderPptDeck();
}

function duplicateCurrentSlide() {
  saveCurrentSlide();
  const cur = pptSlides[currentSlideIndex];
  pptSlides.splice(currentSlideIndex + 1, 0, JSON.parse(JSON.stringify(cur)));
  currentSlideIndex++;
  renderPptDeck();
}

function deleteCurrentSlide() {
  if (pptSlides.length <= 1) {
    alert("Presentations must contain at least one slide.");
    return;
  }
  pptSlides.splice(currentSlideIndex, 1);
  if (currentSlideIndex >= pptSlides.length) currentSlideIndex = pptSlides.length - 1;
  renderPptDeck();
}

function changeSlideBackground(color) {
  if (pptSlides[currentSlideIndex]) {
    pptSlides[currentSlideIndex].bg = color;
    document.getElementById('slide-stage').style.backgroundColor = color;
  }
}

function toggleNotesPane() {
  const pane = document.getElementById('ppt-notes-pane');
  pane.style.height = (pane.style.height === '30px') ? '80px' : '30px';
}

// Slide Show
function startSlideShow() {
  saveCurrentSlide();
  slideShowIndex = 0;
  const modal = document.getElementById('slideshow-modal');
  modal.style.display = 'flex';
  modal.focus();
  renderSlideShowCurrent();
}

function renderSlideShowCurrent() {
  const slide = pptSlides[slideShowIndex];
  if (!slide) return;
  document.getElementById('show-title').innerText = slide.title || '';
  document.getElementById('show-subtitle').innerText = slide.subtitle || '';
  document.getElementById('show-body').innerHTML = slide.body || '';
  const showTitleEl = document.getElementById('show-title');
  if (showTitleEl && slide.titleSize) showTitleEl.style.fontSize = `${slide.titleSize}px`;
  const showSubtitleEl = document.getElementById('show-subtitle');
  if (showSubtitleEl && slide.subtitleSize) showSubtitleEl.style.fontSize = `${slide.subtitleSize}px`;
  document.getElementById('slideshow-modal').style.backgroundColor = slide.bg === '#ffffff' ? '#0f172a' : slide.bg;
  document.getElementById('slideshow-footer').textContent = `Slide ${slideShowIndex + 1} of ${pptSlides.length} (Space/Arrow to advance, Esc to exit)`;
}

function nextSlideShowSlide() {
  slideShowIndex++;
  if (slideShowIndex >= pptSlides.length) {
    exitSlideShow();
  } else {
    renderSlideShowCurrent();
  }
}

function handleSlideShowKey(event) {
  if (event.key === 'Escape') {
    exitSlideShow();
  } else if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
    nextSlideShowSlide();
  } else if (event.key === 'ArrowLeft') {
    if (slideShowIndex > 0) {
      slideShowIndex--;
      renderSlideShowCurrent();
    }
  }
}

function exitSlideShow() {
  document.getElementById('slideshow-modal').style.display = 'none';
}

// --- Status Updates ---
function updateStatus() {
  const statusLeft = document.getElementById('status-left');
  if (currentApp === 'word') {
    statusLeft.textContent = 'MelDocs 365 | ISO/IEC 29500 & ECMA-376 Compliant';
  } else if (currentApp === 'excel') {
    statusLeft.textContent = `MelXL 365 | Active Sheet: ${currentSheetName} | Auto-calc ON`;
  } else if (currentApp === 'ppt') {
    statusLeft.textContent = `MelSlideshows 365 | Slide ${currentSlideIndex + 1} of ${pptSlides.length}`;
  } else if (currentApp === 'pdf') {
    statusLeft.textContent = 'MelPDF 365 | Ready';
  }
}

// --- File Operations ---
function newDocument() {
  if (confirm(`Start new ${currentApp.toUpperCase()} project?`)) {
    if (currentApp === 'word') {
      document.getElementById('doc-canvas').innerHTML = '<h1>New Document</h1><p>Type your content here...</p>';
      handleWordInput();
    } else if (currentApp === 'excel') {
      excelSheets[currentSheetName] = {};
      recalcExcelGrid();
    } else if (currentApp === 'ppt') {
      pptSlides = [{ layout: 'title', title: 'New Presentation', subtitle: 'Subtitle', body: '<p>• Bullet point</p>', notes: '', bg: '#ffffff' }];
      currentSlideIndex = 0;
      renderPptDeck();
    }
  }
}

function triggerOpen() {
  document.getElementById('file-input').click();
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta && meta.match(/data:(.*?);/) ? meta.match(/data:(.*?);/)[1] : 'application/pdf');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToDataUrl(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return 'data:application/pdf;base64,' + btoa(bin);
}

async function applyPdfTextEdit(text, x, y, size) {
  if (!currentPdfFile || !currentPdfFile.dataUrl) return false;
  const bytes = dataUrlToBytes(currentPdfFile.dataUrl);
  const doc = await MelPdfDocument.load(bytes);
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(text, { x, y, size, font });
  const newBytes = await doc.save();
  currentPdfFile = { name: currentPdfFile.name, dataUrl: bytesToDataUrl(newBytes) };
  const viewer = document.getElementById('pdf-viewer');
  if (viewer) viewer.src = currentPdfFile.dataUrl;
  updateStatus();
  return true;
}

async function savePdfDocument() {
  if (!currentPdfFile || !currentPdfFile.dataUrl) return;
  const bytes = dataUrlToBytes(currentPdfFile.dataUrl);
  const blob = dataUrlToBlob(currentPdfFile.dataUrl);
  downloadBlob(blob, currentPdfFile.name);
}

async function handlePdfTextEdit() {
  const text = (document.getElementById('pdf-edit-text') || {}).value || '';
  const size = parseFloat((document.getElementById('pdf-edit-size') || {}).value) || 24;
  const x = parseFloat((document.getElementById('pdf-edit-x') || {}).value) || 72;
  const y = parseFloat((document.getElementById('pdf-edit-y') || {}).value) || 700;
  if (!text) {
    alert('Enter overlay text first.');
    return;
  }
  const ok = await applyPdfTextEdit(text, x, y, size);
  if (ok) alert('PDF text overlay applied: "' + text + '"');
}

async function openPdfFile(file) {
  switchApp('pdf');
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    currentPdfFile = { name: file.name, dataUrl };
    const viewer = document.getElementById('pdf-viewer');
    if (viewer) viewer.src = dataUrl;
    updateStatus();
  };
  reader.readAsDataURL(file);
}

async function handleFileOpen(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  const data = await new Promise((resolve, reject) => {
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });

  if (file.name.endsWith('.docx')) {
      switchApp('word');
      try {
        const doc = await DocxDocument.fromBuffer(data);
        // Render full document content into doc-canvas with proper HTML
        const contentHtml = doc.toHtmlDocument();
        document.getElementById('doc-canvas').innerHTML = `
          ${doc.title ? `<h1 style="text-align:center; color:#1A73E8;">${DocxDocument.escapeHtml(doc.title)}</h1>` : ''}
          ${contentHtml}
        `;
        handleWordInput();
        updateStatus();
      } catch (err) {
        alert('Failed to parse DOCX: ' + err.message);
      }
    } else if (file.name.endsWith('.xlsx')) {
      switchApp('excel');
      try {
        const sheet = await XlsxSpreadsheet.fromBuffer(data);
        // Overwrite excelSheets with loaded cells
        excelSheets = { [sheet.sheetName]: sheet.cells };
        recalcExcelGrid(); // Refresh UI
        switchSheet(sheet.sheetName);
        alert(`Loaded Excel spreadsheet "${file.name}" with ${Object.keys(sheet.cells).length} cells.`);
      } catch (err) {
        alert('Failed to parse XLSX: ' + err.message);
      }
    } else if (file.name.endsWith('.pptx')) {
      switchApp('ppt');
      try {
        const deck = await PptxPresentation.fromBuffer(data);
        pptSlides = deck.slides;
        currentSlideIndex = 0;
        renderPptDeck();
        loadCurrentSlide();
        alert(`Loaded PowerPoint presentation "${file.name}" with ${deck.slides.length} slides.`);
      } catch (err) {
        alert('Failed to parse PPTX: ' + err.message);
      }
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      openPdfFile(file);
    }
}

function saveDocument() {
  exportNativeFile();
}

async function exportNativeFile() {
  if (currentApp === 'pdf') {
    savePdfDocument();
    return;
  } else if (currentApp === 'word') {
    const docx = new DocxDocument({
      title: document.title || 'MelDocs Document',
      artBorder: currentWordBorder || null,
      paragraphs: [
        {
          style: 'Title',
          align: 'center',
          runs: [{ text: 'MelOffice Word Document', bold: true, size: 36, color: '1A73E8' }]
        },
        {
          style: 'Normal',
          align: 'left',
          runs: [
            { text: 'Document saved as OpenXML (DOCX). WordprocessingML content follows ECMA-376.', bold: false, size: 24 }
          ]
        }
      ]
    });
    const buf = await docx.exportBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' });
    downloadBlob(blob, 'MelDocs-Document.docx');
  } else if (currentApp === 'excel') {
    const sheet = new XlsxSpreadsheet({
      cells: excelSheets[currentSheetName] || {}
    });
    const buf = await sheet.exportBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml' });
    downloadBlob(blob, 'MelXL-Sheet.xlsx');
  } else if (currentApp === 'ppt') {
    saveCurrentSlide();
    const deck = new PptxPresentation({ slides: pptSlides });
    const buf = await deck.exportBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml' });
    downloadBlob(blob, 'MelSlideshows-Deck.pptx');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
