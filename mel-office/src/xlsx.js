// MelOffice SpreadsheetML (ECMA-376 sml) Reader, Writer & Calc Engine
const OPCContainer = require('./opc');

class XlsxSpreadsheet {
  constructor(options = {}) {
    this.sheetName = options.sheetName || 'Sheet1';
    // cells: { 'A1': { value: 10, formula: '', style: {} }, 'B1': { ... } }
    this.cells = options.cells || {
      'A1': { value: 'Item', bold: true },
      'B1': { value: 'Quantity', bold: true },
      'C1': { value: 'Unit Price', bold: true },
      'D1': { value: 'Total', bold: true },
      'A2': { value: 'MelWorks Pro' },
      'B2': { value: 5 },
      'C2': { value: 99.99 },
      'D2': { formula: 'B2*C2', value: 499.95 },
      'A3': { value: 'MelPhoto Studio' },
      'B3': { value: 10 },
      'C3': { value: 49.99 },
      'D3': { formula: 'B3*C3', value: 499.90 },
      'A4': { value: 'Sum Total', bold: true },
      'D4': { formula: 'SUM(D2:D3)', value: 999.85, bold: true }
    };
  }

  static colToNumber(col) {
    let result = 0;
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 64);
    }
    return result;
  }

  static numberToCol(num) {
    let col = '';
    while (num > 0) {
      const rem = (num - 1) % 26;
      col = String.fromCharCode(65 + rem) + col;
      num = Math.floor((num - 1) / 26);
    }
    return col;
  }

  static parseCoord(ref) {
    const m = ref.toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
    if (!m) return null;
    return { col: m[1], row: parseInt(m[2], 10), colNum: XlsxSpreadsheet.colToNumber(m[1]) };
  }

  evaluateFormula(formula, visited = new Set()) {
    if (!formula) return 0;
    let expr = formula.trim();
    if (expr.startsWith('=')) expr = expr.substring(1).trim();

    // Check SUM(range)
    const sumMatch = expr.match(/^SUM\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
    if (sumMatch) {
      const start = XlsxSpreadsheet.parseCoord(sumMatch[1]);
      const end = XlsxSpreadsheet.parseCoord(sumMatch[2]);
      let total = 0;
      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.colNum, end.colNum); c <= Math.max(start.colNum, end.colNum); c++) {
          const key = `${XlsxSpreadsheet.numberToCol(c)}${r}`;
          const val = this.getCellValue(key, visited);
          total += Number(val) || 0;
        }
      }
      return total;
    }

    // Check AVERAGE(range)
    const avgMatch = expr.match(/^AVERAGE\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
    if (avgMatch) {
      const start = XlsxSpreadsheet.parseCoord(avgMatch[1]);
      const end = XlsxSpreadsheet.parseCoord(avgMatch[2]);
      let total = 0;
      let count = 0;
      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.colNum, end.colNum); c <= Math.max(start.colNum, end.colNum); c++) {
          const key = `${XlsxSpreadsheet.numberToCol(c)}${r}`;
          const val = this.getCellValue(key, visited);
          if (val !== '' && !isNaN(Number(val))) {
            total += Number(val);
            count++;
          }
        }
      }
      return count > 0 ? total / count : 0;
    }

    // Check MIN(range) / MAX(range) / COUNT(range)
    const minMaxMatch = expr.match(/^(MIN|MAX|COUNT)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i);
    if (minMaxMatch) {
      const fn = minMaxMatch[1].toUpperCase();
      const start = XlsxSpreadsheet.parseCoord(minMaxMatch[2]);
      const end = XlsxSpreadsheet.parseCoord(minMaxMatch[3]);
      let vals = [];
      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.colNum, end.colNum); c <= Math.max(start.colNum, end.colNum); c++) {
          const key = `${XlsxSpreadsheet.numberToCol(c)}${r}`;
          const val = this.getCellValue(key, visited);
          if (val !== '' && !isNaN(Number(val))) vals.push(Number(val));
        }
      }
      if (fn === 'COUNT') return vals.length;
      if (fn === 'MIN') return vals.length ? Math.min(...vals) : 0;
      if (fn === 'MAX') return vals.length ? Math.max(...vals) : 0;
    }

    // Arithmetic expressions e.g. B2*C2 or A1+B1
    const replaced = expr.replace(/[A-Z]+[0-9]+/gi, (m) => {
      const val = this.getCellValue(m.toUpperCase(), visited);
      return Number(val) || 0;
    });

    try {
      // Safe math evaluation
      // ponytail: math expression parser, upgrade to full AST evaluator when user needs custom nested functions
      if (/^[0-9\.\+\-\*\/\(\)\s]+$/.test(replaced)) {
        return Function(`"use strict"; return (${replaced});`)();
      }
    } catch (e) {
      return '#VALUE!';
    }
    return expr;
  }

  getCellValue(coord, visited = new Set()) {
    if (visited.has(coord)) return 0; // prevent circular ref
    visited.add(coord);
    const cell = this.cells[coord];
    if (!cell) return '';
    if (cell.formula) {
      return this.evaluateFormula(cell.formula, visited);
    }
    return cell.value !== undefined ? cell.value : '';
  }

  toWorksheetXml(sharedStringsList) {
    // group cells by row
    const rows = {};
    for (const [coord, cell] of Object.entries(this.cells)) {
      const parsed = XlsxSpreadsheet.parseCoord(coord);
      if (!parsed) continue;
      if (!rows[parsed.row]) rows[parsed.row] = [];
      rows[parsed.row].push({ coord, cell, colNum: parsed.colNum });
    }

    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    xml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;
    xml += `  <sheetData>\n`;

    const sortedRows = Object.keys(rows).map(Number).sort((a, b) => a - b);
    for (const r of sortedRows) {
      xml += `    <row r="${r}">\n`;
      const cellList = rows[r].sort((a, b) => a.colNum - b.colNum);
      for (const { coord, cell } of cellList) {
        const computedVal = cell.formula ? this.evaluateFormula(cell.formula) : cell.value;
        const isNum = typeof computedVal === 'number' || (!isNaN(Number(computedVal)) && computedVal !== '');

        if (cell.formula) {
          xml += `      <c r="${coord}">\n`;
          xml += `        <f>${cell.formula.replace(/^=/, '')}</f>\n`;
          xml += `        <v>${computedVal}</v>\n`;
          xml += `      </c>\n`;
        } else if (isNum) {
          xml += `      <c r="${coord}">\n`;
          xml += `        <v>${computedVal}</v>\n`;
          xml += `      </c>\n`;
        } else {
          // Shared string
          let strIdx = sharedStringsList.indexOf(String(computedVal));
          if (strIdx === -1) {
            strIdx = sharedStringsList.length;
            sharedStringsList.push(String(computedVal));
          }
          xml += `      <c r="${coord}" t="s">\n`;
          xml += `        <v>${strIdx}</v>\n`;
          xml += `      </c>\n`;
        }
      }
      xml += `    </row>\n`;
    }

    xml += `  </sheetData>\n`;
    xml += `</worksheet>`;
    return xml;
  }

  async exportBuffer() {
    const opc = new OPCContainer();
    opc.addDefaultContentType('rels', 'application/vnd.openxmlformats-package.relationships+xml');
    opc.addDefaultContentType('xml', 'application/xml');
    opc.addOverrideContentType('/xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
    opc.addOverrideContentType('/xl/worksheets/sheet1.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
    opc.addOverrideContentType('/xl/sharedStrings.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml');

    opc.addRelationship('rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'xl/workbook.xml');

    const sharedStrings = [];
    const sheet1Xml = this.toWorksheetXml(sharedStrings);
    opc.addFile('xl/worksheets/sheet1.xml', sheet1Xml);

    // sharedStrings.xml
    let sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    sstXml += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">\n`;
    for (const s of sharedStrings) {
      sstXml += `  <si><t>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</t></si>\n`;
    }
    sstXml += `</sst>`;
    opc.addFile('xl/sharedStrings.xml', sstXml);

    // xl/workbook.xml
    let wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    wbXml += `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n`;
    wbXml += `  <sheets>\n`;
    wbXml += `    <sheet name="${this.sheetName}" sheetId="1" r:id="rId1"/>\n`;
    wbXml += `  </sheets>\n`;
    wbXml += `</workbook>`;
    opc.addFile('xl/workbook.xml', wbXml);

    // xl/_rels/workbook.xml.rels
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>\n` +
      `  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>\n` +
      `</Relationships>`;
    opc.addFile('xl/_rels/workbook.xml.rels', wbRels);

    return await opc.exportBuffer();
  }

  static async fromBuffer(buffer) {
    const opc = await OPCContainer.load(buffer);
    const sheet1Xml = await opc.getFile('xl/worksheets/sheet1.xml');
    if (!sheet1Xml) throw new Error('Invalid XLSX: missing xl/worksheets/sheet1.xml');

    const sstXml = await opc.getFile('xl/sharedStrings.xml');
    const sharedStrings = [];
    if (sstXml) {
      const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let m;
      while ((m = tRegex.exec(sstXml)) !== null) {
        sharedStrings.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      }
    }

    const cells = {};
    const cRegex = /<c\s+r="([A-Z0-9]+)"([^>]*)>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cRegex.exec(sheet1Xml)) !== null) {
      const coord = cm[1];
      const attrs = cm[2];
      const body = cm[3];
      const isString = /t="s"/.test(attrs);

      let formula = '';
      const fMatch = body.match(/<f[^>]*>([\s\S]*?)<\/f>/);
      if (fMatch) formula = fMatch[1];

      let value = '';
      const vMatch = body.match(/<v>([\s\S]*?)<\/v>/);
      if (vMatch) {
        if (isString) {
          const idx = parseInt(vMatch[1], 10);
          value = sharedStrings[idx] || '';
        } else {
          value = isNaN(Number(vMatch[1])) ? vMatch[1] : Number(vMatch[1]);
        }
      }

      cells[coord] = { value, formula };
    }

    return new XlsxSpreadsheet({ cells });
  }
}

module.exports = XlsxSpreadsheet;
