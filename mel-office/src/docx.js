// MelOffice WordprocessingML (ECMA-376 wml) Reader & Writer
const OPCContainer = require('./opc');

class DocxDocument {
  constructor(options = {}) {
    this.title = options.title || 'Untitled Document';
    this.background = options.background || null;
    this.paragraphs = options.paragraphs || [
      {
        style: 'Title',
        align: 'center',
        runs: [{ text: 'MelOffice Document', bold: true, size: 48, color: '1A73E8' }]
      },
      {
        style: 'Normal',
        align: 'left',
        runs: [
          { text: 'Welcome to MelOffice Word! Built in strict accordance with the ECMA-376 Office Open XML standard. ', bold: false, size: 24 },
          { text: 'This text is bold and underlined.', bold: true, underline: true, size: 24, color: 'D93025' }
        ]
      }
    ];
    this.tables = options.tables || [];
    this.artBorder = options.artBorder || null; // e.g. 'woodwork', 'zanyTriangles'
  }

  static escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  static escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  toHtmlParagraphs() {
    const alignMap = { left: 'left', center: 'center', right: 'right', justify: 'justify' };
    const html = [];
    for (const p of this.paragraphs) {
      const align = alignMap[p.align] || 'left';
      const style = `text-align:${align};`;
      const runsHtml = (p.runs || []).map(r => {
        const parts = [];
        if (r.bold) parts.push('font-weight:bold');
        if (r.italic) parts.push('font-style:italic');
        if (r.underline) parts.push('text-decoration:underline');
        if (r.strike) parts.push('text-decoration:line-through');
        if (r.color) parts.push(`color:${r.color}`);
        if (r.size) parts.push(`font-size:${r.size}px`);
        const styleAttr = parts.length ? ` style="${parts.join(';')}"` : '';
        const fontFamily = r.font ? ` style="font-family:${DocxDocument.escapeHtml(r.font)}"` : '';
        const escapedText = DocxDocument.escapeHtml(r.text || '');
        const tag = r.bold || r.italic || r.underline ? 'b' : (r.italic ? 'i' : 'span');
        return `<${tag}${styleAttr}${fontFamily}>${escapedText}</${tag}>`;
      }).join('');
      html.push(`<p style="${style}">${runsHtml}</p>`);
    }
    return html.join('');
  }

  toHtmlDocument() {
    const bodyHtml = this.toHtmlParagraphs();
    const tablesHtml = (this.tables || []).map(t => {
      let rowsHtml = '';
      for (const row of t.rows || []) {
        rowsHtml += '<tr>';
        for (const cell of row.cells || []) {
          rowsHtml += `<td>${DocxDocument.escapeHtml(cell.text || '')}</td>`;
        }
        rowsHtml += '</tr>';
      }
      return `<table border="1" style="border-collapse:collapse; border:1px solid #cbd5e1;">${rowsHtml}</table>`;
    }).join('');

    const bgColor = this.background && this.background.color ? this.background.color : '#ffffff';
    return `
      <div style="background-color:${bgColor}; padding:40px; font-family:Calibri, Arial, sans-serif; font-size:24px; line-height:1.5;">
        ${bodyHtml}
        ${tablesHtml}
      </div>
    `;
  }

  toXml() {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    xml += `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" `;
    xml += `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n`;
    xml += `  <w:body>\n`;

    for (const p of this.paragraphs) {
      xml += `    <w:p>\n`;
      xml += `      <w:pPr>\n`;
      if (p.style) {
        xml += `        <w:pStyle w:val="${DocxDocument.escapeXml(p.style)}"/>\n`;
      }
      if (p.align) {
        const jcMap = { left: 'left', center: 'center', right: 'right', justify: 'both' };
        xml += `        <w:jc w:val="${jcMap[p.align] || 'left'}"/>\n`;
      }
      if (this.artBorder) {
        xml += `        <w:pBdr>\n`;
        xml += `          <w:top w:val="${this.artBorder}" w:sz="24" w:space="1" w:color="auto"/>\n`;
        xml += `          <w:bottom w:val="${this.artBorder}" w:sz="24" w:space="1" w:color="auto"/>\n`;
        xml += `        </w:pBdr>\n`;
      }
      xml += `      </w:pPr>\n`;

      if (p.runs) {
        for (const r of p.runs) {
          xml += `      <w:r>\n`;
          xml += `        <w:rPr>\n`;
          if (r.bold) xml += `          <w:b/>\n`;
          if (r.italic) xml += `          <w:i/>\n`;
          if (r.underline) xml += `          <w:u w:val="single"/>\n`;
          if (r.strike) xml += `          <w:strike/>\n`;
          if (r.color) xml += `          <w:color w:val="${r.color.replace('#', '')}"/>\n`;
          if (r.size) xml += `          <w:sz w:val="${r.size}"/>\n`;
          if (r.font) xml += `          <w:rFonts w:ascii="${DocxDocument.escapeXml(r.font)}" w:hAnsi="${DocxDocument.escapeXml(r.font)}"/>\n`;
          xml += `        </w:rPr>\n`;
          xml += `        <w:t xml:space="preserve">${DocxDocument.escapeXml(r.text)}</w:t>\n`;
          xml += `      </w:r>\n`;
        }
      }
      xml += `    </w:p>\n`;
    }

    // Tables
    for (const tbl of this.tables) {
      xml += `    <w:tbl>\n`;
      xml += `      <w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>\n`;
      for (const row of tbl.rows) {
        xml += `      <w:tr>\n`;
        for (const cell of row.cells) {
          xml += `        <w:tc>\n`;
          xml += `          <w:p><w:r><w:t>${DocxDocument.escapeXml(cell.text || '')}</w:t></w:r></w:p>\n`;
          xml += `        </w:tc>\n`;
        }
        xml += `      </w:tr>\n`;
      }
      xml += `    </w:tbl>\n`;
    }

    xml += `    <w:sectPr>\n`;
    xml += `      <w:pgSz w:w="12240" w:h="15840"/>\n`; // Letter size
    xml += `      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>\n`; // 1 inch margins
    xml += `    </w:sectPr>\n`;
    xml += `  </w:body>\n`;
    xml += `</w:document>`;
    return xml;
  }

  async exportBuffer() {
    const opc = new OPCContainer();
    opc.addDefaultContentType('rels', 'application/vnd.openxmlformats-package.relationships+xml');
    opc.addDefaultContentType('xml', 'application/xml');
    opc.addOverrideContentType('/word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');

    opc.addRelationship(
      'rId1',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
      'word/document.xml'
    );

    opc.addFile('word/document.xml', this.toXml());

    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
      `</Relationships>`;
    opc.addFile('word/_rels/document.xml.rels', docRels);

    return await opc.exportBuffer();
  }

  static async fromBuffer(buffer) {
    const opc = await OPCContainer.load(buffer);
    const docXml = await opc.getFile('word/document.xml');
    if (!docXml) throw new Error('Invalid DOCX: missing word/document.xml');

    const paragraphs = [];
    // Regex parsing for paragraphs in wml (lightweight and dependency-free)
    const pRegex = /<w:p[\s>]([\s\S]*?)<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(docXml)) !== null) {
      const pBody = pMatch[1];
      let align = 'left';
      const jcMatch = pBody.match(/<w:jc\s+w:val="([^"]+)"/);
      if (jcMatch) {
        const jc = jcMatch[1];
        if (jc === 'center') align = 'center';
        else if (jc === 'right') align = 'right';
        else if (jc === 'both') align = 'justify';
      }

      let style = 'Normal';
      const styleMatch = pBody.match(/<w:pStyle\s+w:val="([^"]+)"/);
      if (styleMatch) style = styleMatch[1];

      const runs = [];
      const rRegex = /<w:r[\s>]([\s\S]*?)<\/w:r>/g;
      let rMatch;
      while ((rMatch = rRegex.exec(pBody)) !== null) {
        const rBody = rMatch[1];
        const bold = /<w:b(\s*\/|\s+[^>]*\/)?>/.test(rBody);
        const italic = /<w:i(\s*\/|\s+[^>]*\/)?>/.test(rBody);
        const underline = /<w:u\s+w:val=/.test(rBody);
        const strike = /<w:strike/.test(rBody);

        let color = null;
        const colorMatch = rBody.match(/<w:color\s+w:val="([^"]+)"/);
        if (colorMatch) color = '#' + colorMatch[1];

        let size = 24;
        const sizeMatch = rBody.match(/<w:sz\s+w:val="([^"]+)"/);
        if (sizeMatch) size = parseInt(sizeMatch[1], 10);

        let text = '';
        const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(rBody)) !== null) {
          text += tMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        }

        if (text.length > 0) {
          runs.push({ text, bold, italic, underline, strike, color, size });
        }
      }

      if (runs.length > 0) {
        paragraphs.push({ style, align, runs });
      }
    }

    // Tables (w:tbl / w:tr / w:tc) -> structured tables for round-tripping
    const tables = [];
    const tblRegex = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
    let tblMatch;
    while ((tblMatch = tblRegex.exec(docXml)) !== null) {
      const tblBody = tblMatch[1];
      const rows = [];
      const trRegex = /<w:tr>([\s\S]*?)<\/w:tr>/g;
      let trMatch;
      while ((trMatch = trRegex.exec(tblBody)) !== null) {
        const trBody = trMatch[1];
        const cells = [];
        const tcRegex = /<w:tc>([\s\S]*?)<\/w:tc>/g;
        let tcMatch;
        while ((tcMatch = tcRegex.exec(trBody)) !== null) {
          const tcBody = tcMatch[1];
          let cellText = '';
          const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
          let tMatch;
          while ((tMatch = tRegex.exec(tcBody)) !== null) {
            cellText += tMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'");
          }
          cells.push({ text: cellText });
        }
        if (cells.length > 0) rows.push({ cells });
      }
      if (rows.length > 0) tables.push({ rows });
    }

    const doc = new DocxDocument({ paragraphs, tables });
    // Only surface a title when the document actually declares one (e.g. Title style paragraph)
    const titlePara = paragraphs.find(p => p.style === 'Title');
    doc.title = (titlePara && titlePara.runs && titlePara.runs[0] && titlePara.runs[0].text) ? titlePara.runs[0].text : '';
    return doc;
  }
}

module.exports = DocxDocument;
