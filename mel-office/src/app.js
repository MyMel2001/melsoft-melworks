// MelOffice 365 Client Application Engine
let currentApp = 'word'; // 'word', 'excel', 'ppt'
let currentRibbonTab = 'home';

// --- MelExcel State ---
const EXCEL_COLS = 26; // A to Z
const EXCEL_ROWS = 40;
let excelData = {}; // 'A1': { val: '', formula: '' }
let selectedCell = 'A1';

// --- MelPowerPoint State ---
let pptSlides = [
  {
    title: 'MelOffice Presentation',
    subtitle: 'ECMA-376 PresentationML Slide Deck',
    body: '<p>• Full native support for PresentationML (pml.xsd)</p><p>• Dynamic multi-slide presentation manager</p><p>• Export directly to Microsoft PowerPoint .pptx files</p>',
    bg: '#ffffff'
  },
  {
    title: 'Next Generation Architecture',
    subtitle: 'Built on NodeJS and Open Standards',
    body: '<p>• Zero heavy runtime dependencies</p><p>• Native Open Packaging Conventions (OPC) packaging</p><p>• High-performance cross-platform support</p>',
    bg: '#ffffff'
  }
];
let currentSlideIndex = 0;
let slideShowIndex = 0;

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  initExcelGrid();
  loadSampleExcelData();
  renderPptDeck();
  updateStatus();
});

// --- App Switching ---
function switchApp(app) {
  currentApp = app;

  // Title bar themes and buttons
  const titlebar = document.getElementById('titlebar');
  const brandIcon = document.getElementById('brand-icon');
  const brandText = document.getElementById('brand-text');

  document.querySelectorAll('.app-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-switch-${app}`).classList.add('active');

  titlebar.className = 'titlebar';
  if (app === 'excel') titlebar.classList.add('excel-theme');
  if (app === 'ppt') titlebar.classList.add('ppt-theme');

  const appMeta = {
    word: { icon: 'W', text: 'MelWord - MelOffice 365', tab: 'Layout & Borders' },
    excel: { icon: 'X', text: 'MelExcel - MelOffice 365', tab: 'Formulas & Data' },
    ppt: { icon: 'P', text: 'MelPowerPoint - MelOffice 365', tab: 'Slide Design' }
  };

  brandIcon.textContent = appMeta[app].icon;
  brandText.textContent = appMeta[app].text;
  document.getElementById('tab-app-specific').textContent = appMeta[app].tab;

  // Workspaces
  document.getElementById('doc-canvas').style.display = (app === 'word') ? 'block' : 'none';
  document.getElementById('excel-container').style.display = (app === 'excel') ? 'flex' : 'none';
  document.getElementById('ppt-container').style.display = (app === 'ppt') ? 'flex' : 'none';

  // Ribbon contextual tool groups
  document.getElementById('group-text-formatting').style.display = (app === 'excel') ? 'none' : 'inline-flex';
  document.getElementById('group-alignment').style.display = (app === 'word') ? 'inline-flex' : 'none';
  document.getElementById('group-excel-quick').style.display = (app === 'excel') ? 'inline-flex' : 'none';
  document.getElementById('group-ppt-quick').style.display = (app === 'ppt') ? 'inline-flex' : 'none';
  document.getElementById('group-word-art-borders').style.display = (app === 'word') ? 'inline-flex' : 'none';
  document.getElementById('group-ppt-layout').style.display = (app === 'ppt') ? 'inline-flex' : 'none';

  updateStatus();
}

// --- Ribbon Tabs ---
function switchRibbonTab(tabName) {
  currentRibbonTab = tabName;
  document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
  const tabs = document.querySelectorAll('.ribbon-tab');
  if (tabName === 'home') tabs[0].classList.add('active');
  if (tabName === 'insert') tabs[1].classList.add('active');
  if (tabName === 'specific') tabs[2].classList.add('active');
  if (tabName === 'file') tabs[3].classList.add('active');

  document.getElementById('ribbon-home').style.display = (tabName === 'home') ? 'flex' : 'none';
  document.getElementById('ribbon-insert').style.display = (tabName === 'insert') ? 'flex' : 'none';
  document.getElementById('ribbon-specific').style.display = (tabName === 'specific') ? 'flex' : 'none';
  document.getElementById('ribbon-file').style.display = (tabName === 'file') ? 'flex' : 'none';
}

// --- MelWord Formatting ---
function formatDoc(cmd, val = null) {
  document.execCommand(cmd, false, val);
  document.getElementById('doc-canvas').focus();
  updateStatus();
}

function insertHeading(level) {
  formatDoc('formatBlock', `<h${level}>`);
}

function insertHorizontalRule() {
  formatDoc('insertHorizontalRule');
}

function insertTable() {
  const tableHtml = `
    <table border="1" style="width: 100%; border-collapse: collapse; border-color: #cbd5e1; margin: 12px 0;">
      <thead>
        <tr style="background:#f8fafc;"><th style="padding:6px;">Col 1</th><th style="padding:6px;">Col 2</th><th style="padding:6px;">Col 3</th></tr>
      </thead>
      <tbody>
        <tr><td style="padding:6px;">Data A1</td><td style="padding:6px;">Data B1</td><td style="padding:6px;">Data C1</td></tr>
        <tr><td style="padding:6px;">Data A2</td><td style="padding:6px;">Data B2</td><td style="padding:6px;">Data C2</td></tr>
      </tbody>
    </table><p></p>
  `;
  document.execCommand('insertHTML', false, tableHtml);
}

function applyArtBorder(borderName) {
  const canvas = document.getElementById('doc-canvas');
  canvas.classList.remove('art-border-woodwork', 'art-border-zanyTriangles', 'art-border-zigZag');
  if (borderName !== 'none') {
    canvas.classList.add(`art-border-${borderName}`);
  }
}

// --- MelExcel Engine ---
function colName(index) {
  return String.fromCharCode(65 + index);
}

function initExcelGrid() {
  const table = document.getElementById('excel-table');
  table.innerHTML = '';

  // Header row
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.style.width = '40px';
  corner.textContent = '#';
  hRow.appendChild(corner);

  for (let c = 0; c < EXCEL_COLS; c++) {
    const th = document.createElement('th');
    th.textContent = colName(c);
    hRow.appendChild(th);
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  for (let r = 1; r <= EXCEL_ROWS; r++) {
    const tr = document.createElement('tr');
    const rTh = document.createElement('th');
    rTh.textContent = r;
    tr.appendChild(rTh);

    for (let c = 0; c < EXCEL_COLS; c++) {
      const coord = `${colName(c)}${r}`;
      const td = document.createElement('td');
      td.id = `cell-${coord}`;
      td.dataset.coord = coord;
      td.contentEditable = "true";

      td.addEventListener('focus', () => selectCell(coord));
      td.addEventListener('blur', () => commitCellFromGrid(coord));
      td.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          td.blur();
          // move down
          const next = document.getElementById(`cell-${colName(c)}${r + 1}`);
          if (next) next.focus();
        }
      });

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

function loadSampleExcelData() {
  excelData = {
    'A1': { val: 'Product', formula: '' },
    'B1': { val: 'Units', formula: '' },
    'C1': { val: 'Unit Price', formula: '' },
    'D1': { val: 'Revenue', formula: '' },
    'A2': { val: 'MelOffice Suite', formula: '' },
    'B2': { val: '120', formula: '' },
    'C2': { val: '249.99', formula: '' },
    'D2': { val: '', formula: '=B2*C2' },
    'A3': { val: 'MelPhoto Studio', formula: '' },
    'B3': { val: '85', formula: '' },
    'C3': { val: '199.99', formula: '' },
    'D3': { val: '', formula: '=B3*C3' },
    'A4': { val: 'MelFlash Pro', formula: '' },
    'B4': { val: '64', formula: '' },
    'C4': { val: '149.99', formula: '' },
    'D4': { val: '', formula: '=B4*C4' },
    'A5': { val: 'MelCAD 2026', formula: '' },
    'B5': { val: '40', formula: '' },
    'C5': { val: '799.99', formula: '' },
    'D5': { val: '', formula: '=B5*C5' },
    'A6': { val: 'TOTAL REVENUE', formula: '' },
    'D6': { val: '', formula: '=SUM(D2:D5)' }
  };
  recalcExcelGrid();
}

function selectCell(coord) {
  selectedCell = coord;
  document.querySelectorAll('.excel-grid td').forEach(td => td.classList.remove('selected'));
  const td = document.getElementById(`cell-${coord}`);
  if (td) td.classList.add('selected');

  document.getElementById('selected-cell-id').value = coord;
  const cell = excelData[coord] || { val: '', formula: '' };
  document.getElementById('fx-bar').value = cell.formula ? cell.formula : cell.val;
}

function commitCellFromGrid(coord) {
  const td = document.getElementById(`cell-${coord}`);
  if (!td) return;
  const text = td.textContent.trim();
  if (text.startsWith('=')) {
    excelData[coord] = { val: '', formula: text };
  } else {
    excelData[coord] = { val: text, formula: '' };
  }
  recalcExcelGrid();
}

function handleFxKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const val = event.target.value.trim();
    if (val.startsWith('=')) {
      excelData[selectedCell] = { val: '', formula: val };
    } else {
      excelData[selectedCell] = { val: val, formula: '' };
    }
    recalcExcelGrid();
  }
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
  return formula;
}

function parseRange(start, end) {
  const startCol = start.charCodeAt(0) - 65;
  const startRow = parseInt(start.substring(1), 10);
  const endCol = end.charCodeAt(0) - 65;
  const endRow = parseInt(end.substring(1), 10);

  const coords = [];
  for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
    for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
      coords.push(`${colName(c)}${r}`);
    }
  }
  return coords;
}

function getCellValueBrowser(coord, visited = new Set()) {
  if (visited.has(coord)) return 0;
  visited.add(coord);
  const cell = excelData[coord];
  if (!cell) return '';
  if (cell.formula) {
    return evaluateFormulaBrowser(cell.formula, visited);
  }
  return cell.val;
}

function recalcExcelGrid() {
  for (let r = 1; r <= EXCEL_ROWS; r++) {
    for (let c = 0; c < EXCEL_COLS; c++) {
      const coord = `${colName(c)}${r}`;
      const td = document.getElementById(`cell-${coord}`);
      if (!td) continue;
      const cell = excelData[coord];
      if (cell) {
        if (cell.formula) {
          td.textContent = evaluateFormulaBrowser(cell.formula);
        } else {
          td.textContent = cell.val;
        }
      } else {
        td.textContent = '';
      }
    }
  }
  updateStatus();
}

function insertExcelSum() {
  excelData[selectedCell] = { val: '', formula: '=SUM(D2:D5)' };
  recalcExcelGrid();
}

function applyExcelFormat(type) {
  const td = document.getElementById(`cell-${selectedCell}`);
  if (!td) return;
  const cur = parseFloat(td.textContent) || 0;
  if (type === 'currency') td.textContent = `$${cur.toFixed(2)}`;
  if (type === 'percent') td.textContent = `${(cur * 100).toFixed(1)}%`;
}

// --- MelPowerPoint Engine ---
function renderPptDeck() {
  const deck = document.getElementById('ppt-deck');
  deck.innerHTML = '';

  pptSlides.forEach((slide, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `slide-thumb ${idx === currentSlideIndex ? 'active' : ''}`;
    thumb.innerHTML = `<strong>Slide ${idx + 1}</strong><div style="font-size:9px; margin-top:4px; opacity:0.8;">${slide.title}</div>`;
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
  }
}

function loadCurrentSlide() {
  const slide = pptSlides[currentSlideIndex];
  if (!slide) return;
  document.getElementById('slide-title').innerText = slide.title;
  document.getElementById('slide-subtitle').innerText = slide.subtitle;
  document.getElementById('slide-body').innerHTML = slide.body;
  document.getElementById('slide-stage').style.backgroundColor = slide.bg || '#ffffff';
}

function addNewSlide() {
  saveCurrentSlide();
  pptSlides.push({
    title: `New Slide ${pptSlides.length + 1}`,
    subtitle: 'Subtitle text',
    body: '<p>• Add your bullet points or content here</p>',
    bg: '#ffffff'
  });
  currentSlideIndex = pptSlides.length - 1;
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
  if (!slide) {
    document.getElementById('slideshow-modal').style.display = 'none';
    return;
  }
  document.getElementById('show-title').innerText = slide.title;
  document.getElementById('show-subtitle').innerText = slide.subtitle;
  document.getElementById('show-body').innerHTML = slide.body;
  document.getElementById('slideshow-content').style.backgroundColor = slide.bg || '#ffffff';
}

function nextSlideShowSlide() {
  slideShowIndex++;
  if (slideShowIndex >= pptSlides.length) {
    document.getElementById('slideshow-modal').style.display = 'none';
  } else {
    renderSlideShowCurrent();
  }
}

function handleSlideShowKey(e) {
  if (e.key === 'Escape') {
    document.getElementById('slideshow-modal').style.display = 'none';
  } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
    nextSlideShowSlide();
  } else if (e.key === 'ArrowLeft') {
    if (slideShowIndex > 0) {
      slideShowIndex--;
      renderSlideShowCurrent();
    }
  }
}

// Global F5 key listener
window.addEventListener('keydown', (e) => {
  if (e.key === 'F5') {
    e.preventDefault();
    if (currentApp === 'ppt') startSlideShow();
  }
});

// --- File Operations ---
function newDocument() {
  if (currentApp === 'word') {
    document.getElementById('doc-canvas').innerHTML = '<h1>Untitled Document</h1><p>Start writing here...</p>';
  } else if (currentApp === 'excel') {
    excelData = {};
    recalcExcelGrid();
  } else if (currentApp === 'ppt') {
    pptSlides = [{
      title: 'New Presentation',
      subtitle: 'Add subtitle',
      body: '<p>• Bullet point</p>',
      bg: '#ffffff'
    }];
    currentSlideIndex = 0;
    renderPptDeck();
  }
}

function triggerOpen() {
  document.getElementById('file-input').click();
}

async function handleFileOpen(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (fileName.endsWith('.docx') || fileName.endsWith('.xlsx') || fileName.endsWith('.pptx')) {
    const zip = await JSZip.loadAsync(arrayBuffer);

    if (fileName.endsWith('.docx')) {
      switchApp('word');
      const docXml = await zip.file('word/document.xml').async('text');
      // Parse paragraphs from docx
      const pMatches = docXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
      let html = '';
      for (const p of pMatches) {
        const tMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
        const text = tMatches.map(t => t.replace(/<\/?w:t[^>]*>/g, '')).join('');
        if (/<w:pStyle\s+w:val="Title"/.test(p)) {
          html += `<h1>${text}</h1>`;
        } else {
          html += `<p>${text}</p>`;
        }
      }
      document.getElementById('doc-canvas').innerHTML = html || '<p>Empty Document</p>';
    } else if (fileName.endsWith('.xlsx')) {
      switchApp('excel');
      const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('text');
      const sharedXml = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('text') : null;
      const sst = [];
      if (sharedXml) {
        const matches = sharedXml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
        matches.forEach(m => sst.push(m.replace(/<\/?t[^>]*>/g, '')));
      }

      excelData = {};
      const cMatches = sheetXml.match(/<c\s+r="([A-Z0-9]+)"[^>]*>[\s\S]*?<\/c>/g) || [];
      for (const cm of cMatches) {
        const coord = cm.match(/r="([A-Z0-9]+)"/)[1];
        const isStr = /t="s"/.test(cm);
        const fMatch = cm.match(/<f[^>]*>([\s\S]*?)<\/f>/);
        const vMatch = cm.match(/<v>([\s\S]*?)<\/v>/);

        let val = '';
        if (vMatch) {
          val = isStr ? (sst[parseInt(vMatch[1], 10)] || '') : vMatch[1];
        }
        excelData[coord] = { val: val, formula: fMatch ? `=${fMatch[1]}` : '' };
      }
      recalcExcelGrid();
    } else if (fileName.endsWith('.pptx')) {
      switchApp('ppt');
      pptSlides = [];
      let idx = 1;
      while (zip.file(`ppt/slides/slide${idx}.xml`)) {
        const sXml = await zip.file(`ppt/slides/slide${idx}.xml`).async('text');
        const tMatches = sXml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
        const texts = tMatches.map(m => m.replace(/<\/?a:t>/g, ''));
        pptSlides.push({
          title: texts[0] || `Slide ${idx}`,
          subtitle: texts[1] || '',
          body: texts.slice(2).map(t => `<p>• ${t}</p>`).join(''),
          bg: '#ffffff'
        });
        idx++;
      }
      if (pptSlides.length === 0) {
        pptSlides.push({ title: 'Slide 1', subtitle: '', body: '', bg: '#ffffff' });
      }
      currentSlideIndex = 0;
      renderPptDeck();
    }
  } else if (fileName.endsWith('.json')) {
    const text = new TextDecoder().decode(arrayBuffer);
    const data = JSON.parse(text);
    if (data.app === 'word') {
      switchApp('word');
      document.getElementById('doc-canvas').innerHTML = data.content;
    } else if (data.app === 'excel') {
      switchApp('excel');
      excelData = data.cells;
      recalcExcelGrid();
    } else if (data.app === 'ppt') {
      switchApp('ppt');
      pptSlides = data.slides;
      currentSlideIndex = 0;
      renderPptDeck();
    }
  }
}

async function exportNativeFile() {
  const zip = new JSZip();

  if (currentApp === 'word') {
    // Export .docx
    const content = document.getElementById('doc-canvas').innerText;
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    let docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n` +
      `  <w:body>\n`;
    for (const line of lines) {
      docXml += `    <w:p><w:r><w:t>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>\n`;
    }
    docXml += `  </w:body>\n</w:document>`;

    zip.file('[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
      `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n` +
      `  <Default Extension="xml" ContentType="application/xml"/>\n` +
      `  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n` +
      `</Types>`);

    zip.file('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n` +
      `</Relationships>`);

    zip.file('word/document.xml', docXml);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'MelWord-Document.docx');

  } else if (currentApp === 'excel') {
    // Export .xlsx
    let sst = [];
    let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>\n`;

    for (let r = 1; r <= EXCEL_ROWS; r++) {
      let rowXml = '';
      for (let c = 0; c < EXCEL_COLS; c++) {
        const coord = `${colName(c)}${r}`;
        const cell = excelData[coord];
        if (cell && (cell.val !== '' || cell.formula !== '')) {
          if (cell.formula) {
            const computed = evaluateFormulaBrowser(cell.formula);
            rowXml += `<c r="${coord}"><f>${cell.formula.replace(/^=/, '')}</f><v>${computed}</v></c>`;
          } else if (!isNaN(Number(cell.val)) && cell.val !== '') {
            rowXml += `<c r="${coord}"><v>${cell.val}</v></c>`;
          } else {
            let idx = sst.indexOf(cell.val);
            if (idx === -1) { idx = sst.length; sst.push(cell.val); }
            rowXml += `<c r="${coord}" t="s"><v>${idx}</v></c>`;
          }
        }
      }
      if (rowXml) sheetXml += `  <row r="${r}">${rowXml}</row>\n`;
    }
    sheetXml += `</sheetData></worksheet>`;

    let sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">\n`;
    for (const s of sst) {
      sstXml += `  <si><t>${String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</t></si>\n`;
    }
    sstXml += `</sst>`;

    zip.file('[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
      `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n` +
      `  <Default Extension="xml" ContentType="application/xml"/>\n` +
      `  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\n` +
      `  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n` +
      `  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>\n` +
      `</Types>`);

    zip.file('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n` +
      `</Relationships>`);

    zip.file('xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`);

    zip.file('xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>\n` +
      `  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>\n` +
      `</Relationships>`);

    zip.file('xl/worksheets/sheet1.xml', sheetXml);
    zip.file('xl/sharedStrings.xml', sstXml);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'MelExcel-Spreadsheet.xlsx');

  } else if (currentApp === 'ppt') {
    // Export .pptx
    saveCurrentSlide();
    zip.file('[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
      `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n` +
      `  <Default Extension="xml" ContentType="application/xml"/>\n` +
      `  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>\n` +
      pptSlides.map((_, i) => `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`).join('') +
      `</Types>`);

    zip.file('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>\n` +
      `</Relationships>`);

    let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;
    let presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>\n`;

    pptSlides.forEach((slide, i) => {
      const idx = i + 1;
      const relId = `rId${idx + 10}`;
      presXml += `  <p:sldId id="${255 + idx}" r:id="${relId}"/>\n`;
      presRels += `  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx}.xml"/>\n`;

      const sldXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n` +
        `  <p:cSld><p:spTree>\n` +
        `    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\n` +
        `    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n` +
        `    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>${slide.title}</a:t></a:r></a:p></p:txBody></p:sp>\n` +
        `    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>${slide.subtitle}</a:t></a:r></a:p></p:txBody></p:sp>\n` +
        `  </p:spTree></p:cSld>\n` +
        `</p:sld>`;
      zip.file(`ppt/slides/slide${idx}.xml`, sldXml);
    });

    presXml += `</p:sldIdLst></p:presentation>`;
    presRels += `</Relationships>`;

    zip.file('ppt/presentation.xml', presXml);
    zip.file('ppt/_rels/presentation.xml.rels', presRels);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'MelPowerPoint-Deck.pptx');
  }
}

function exportJSON() {
  let data = {};
  if (currentApp === 'word') {
    data = { app: 'word', content: document.getElementById('doc-canvas').innerHTML };
  } else if (currentApp === 'excel') {
    data = { app: 'excel', cells: excelData };
  } else if (currentApp === 'ppt') {
    saveCurrentSlide();
    data = { app: 'ppt', slides: pptSlides };
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `MelOffice-${currentApp}-project.json`);
}

function saveDocument() {
  exportNativeFile();
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

function updateStatus() {
  const left = document.getElementById('status-left');
  if (currentApp === 'word') {
    const text = document.getElementById('doc-canvas').innerText;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    left.textContent = `MelWord | Words: ${words} | Page 1 of 1`;
  } else if (currentApp === 'excel') {
    const count = Object.keys(excelData).filter(k => excelData[k].val || excelData[k].formula).length;
    left.textContent = `MelExcel | Active Cells: ${count} | Selected: ${selectedCell}`;
  } else if (currentApp === 'ppt') {
    left.textContent = `MelPowerPoint | Slide ${currentSlideIndex + 1} of ${pptSlides.length}`;
  }
}
