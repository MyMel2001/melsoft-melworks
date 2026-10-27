// MelOffice WordprocessingML (ECMA-376 wml) Reader & Writer
const OPCContainer = require('./opc');

class DocxDocument {
  constructor(options = {}) {
    this.title = options.title || 'Untitled Document';
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

    return new DocxDocument({ paragraphs });
  }
}

module.exports = DocxDocument;
