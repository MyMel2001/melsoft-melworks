// MelOffice PresentationML (ECMA-376 pml) Reader & Writer
const OPCContainer = require('./opc');

class PptxPresentation {
  constructor(options = {}) {
    this.slides = options.slides || [
      {
        title: 'MelOffice Presentation',
        subtitle: 'Created with MelSlideshows (ECMA-376 OpenXML standard)',
        background: '#1E293B',
        textColor: '#FFFFFF',
        elements: [
          { type: 'text', text: 'MelSoft Enterprise Solutions 2026', x: 100, y: 280, size: 24, color: '#38BDF8' }
        ]
      },
      {
        title: 'High Performance & Modularity',
        subtitle: 'Key Architectural Highlights',
        background: '#FFFFFF',
        textColor: '#0F172A',
        elements: [
          { type: 'text', text: '• Native Electron / Node.js Engine\n• 100% ECMA-376 Strict XML Compatibility\n• Fully Responsive Ribbon UI', x: 80, y: 150, size: 20, color: '#334155' },
          { type: 'shape', shape: 'rect', x: 500, y: 140, w: 200, h: 120, fill: '#0284C7' }
        ]
      }
    ];
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

  generateSlideXml(slide, index) {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    xml += `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `;
    xml += `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `;
    xml += `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n`;
    xml += `  <p:cSld>\n`;
    xml += `    <p:spTree>\n`;
    xml += `      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\n`;
    xml += `      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>\n`;

    // Title Shape
    xml += `      <p:sp>\n`;
    xml += `        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>\n`;
    xml += `        <p:spPr><a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr>\n`;
    xml += `        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" b="${slide.titleBold ? '1' : '0'}" sz="${Math.round((slide.titleSize || 36) * 100)}"/><a:t>${PptxPresentation.escapeXml(slide.title)}</a:t></a:r></a:p></p:txBody>\n`;
    xml += `      </p:sp>\n`;

    // Subtitle Shape
    if (slide.subtitle) {
      xml += `      <p:sp>\n`;
      xml += `        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>\n`;
      xml += `        <p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></a:xfrm></p:spPr>\n`;
      xml += `        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${Math.round((slide.subtitleSize || 20) * 100)}"/><a:t>${PptxPresentation.escapeXml(slide.subtitle)}</a:t></a:r></a:p></p:txBody>\n`;
      xml += `      </p:sp>\n`;
    }

    // Additional Elements
    if (slide.elements) {
      let idCounter = 10;
      for (const el of slide.elements) {
        idCounter++;
        if (el.type === 'text') {
          xml += `      <p:sp>\n`;
          xml += `        <p:nvSpPr><p:cNvPr id="${idCounter}" name="TextBox"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>\n`;
          xml += `        <p:spPr><a:xfrm><a:off x="${(el.x || 100) * 9525}" y="${(el.y || 100) * 9525}"/><a:ext cx="4000000" cy="1000000"/></a:xfrm></p:spPr>\n`;
          xml += `        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${(el.size || 18) * 100}"/><a:t>${PptxPresentation.escapeXml(el.text)}</a:t></a:r></a:p></p:txBody>\n`;
          xml += `      </p:sp>\n`;
        }
      }
    }

    xml += `    </p:spTree>\n`;
    xml += `  </p:cSld>\n`;
    xml += `</p:sld>`;
    return xml;
  }

  async exportBuffer() {
    const opc = new OPCContainer();
    opc.addDefaultContentType('rels', 'application/vnd.openxmlformats-package.relationships+xml');
    opc.addDefaultContentType('xml', 'application/xml');
    opc.addOverrideContentType('/ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');

    opc.addRelationship('rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'ppt/presentation.xml');

    let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;

    let presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    presXml += `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `;
    presXml += `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `;
    presXml += `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\n`;
    presXml += `  <p:sldMasterIdLst/>\n`;
    presXml += `  <p:sldIdLst>\n`;

    this.slides.forEach((slide, idx) => {
      const sldNum = idx + 1;
      const relId = `rId${sldNum + 10}`;
      const slidePath = `ppt/slides/slide${sldNum}.xml`;
      opc.addOverrideContentType(`/${slidePath}`, 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
      opc.addFile(slidePath, this.generateSlideXml(slide, sldNum));

      presXml += `    <p:sldId id="${255 + sldNum}" r:id="${relId}"/>\n`;
      presRels += `  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${sldNum}.xml"/>\n`;
    });

    presXml += `  </p:sldIdLst>\n`;
    presXml += `  <p:sldSz cx="9144000" cy="6858000"/>\n`; // standard 4:3 or 16:9
    presXml += `</p:presentation>`;

    presRels += `</Relationships>`;

    opc.addFile('ppt/presentation.xml', presXml);
    opc.addFile('ppt/_rels/presentation.xml.rels', presRels);

    return await opc.exportBuffer();
  }

  static async fromBuffer(buffer) {
    const opc = await OPCContainer.load(buffer);
    const presXml = await opc.getFile('ppt/presentation.xml');
    if (!presXml) throw new Error('Invalid PPTX: missing ppt/presentation.xml');

    const slides = [];
    const sldIdRegex = /<p:sldId\s+id="([^"]+)"\s+r:id="([^"]+)"/g;
    let match;
    let index = 1;
    while ((match = sldIdRegex.exec(presXml)) !== null) {
      const slideXml = await opc.getFile(`ppt/slides/slide${index}.xml`);
      if (slideXml) {
        const titleText = { text: '', size: 36, bold: true, color: '#1e293b' };
        const subtitleText = { text: '', size: 20, bold: false, color: '#475569' };
        const background = '#FFFFFF';
        const textColor = '#0F172A';
        const elements = [];

        const decodeXml = (str) => str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");

        const textFromRuns = (rXml) => {
          let text = '';
          const rtRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
          let tm;
          while ((tm = rtRegex.exec(rXml)) !== null) {
            text += decodeXml(tm[1]);
          }
          return text;
        };

        const formatFromRun = (rXml) => {
          const bold = /<a:rPr[^>]*b="1"/.test(rXml);
          const szMatch = rXml.match(/<a:rPr[^>]*sz="([\d.]+)"/);
          const size = szMatch ? parseFloat(szMatch[1]) / 100 : 18;
          const colorMatch = rXml.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([0-9A-Fa-f]+)"/);
          const color = colorMatch ? '#' + colorMatch[1] : '#334155';
          const typeface = (rXml.match(/<a:latin typeface="([^"]*)"/) || [])[1];
          return { bold, size, color, typeface };
        };

        const resolveImage = async (relId) => {
          const relsXml = await opc.getFile(`ppt/slides/_rels/slide${index}.xml.rels`);
          if (!relsXml) return null;
          const relMatch = relsXml.match(new RegExp(`<Relationship[^>]*Id="${relId}"[^>]*Target="([^"]*)"`, 'i'));
          if (!relMatch) return null;
          let path = relMatch[1];
          if (path.startsWith('/')) path = path.slice(1);
          const segments = (`ppt/slides/${path}`).split('/');
          const out = [];
          for (const seg of segments) {
            if (!seg || seg === '.') continue;
            if (seg === '..') { out.pop(); continue; }
            out.push(seg);
          }
          const imgData = await opc.getBinaryFile(out.join('/'));
          if (imgData) {
            return { data: imgData, filename: path.split('/').pop().toLowerCase() };
          }
          return null;
        };

        const spRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
        let spMatch;
        while ((spMatch = spRegex.exec(slideXml)) !== null) {
          const spXml = spMatch[1];
          const nameMatch = spXml.match(/<p:cNvPr id="[^"]*"[^>]*name="([^"]*)"/);
          const phMatchResult = spXml.match(/<p:nvPr>\s*<p:ph([^>]*)>/);
          const phType = phMatchResult ? (phMatchResult[1].match(/type="([^"]*)"/) || [])[1] : null;

          const offMatch = spXml.match(/<a:xfrm>\s*<a:off x="([\d.]+)" y="([\d.]+)"/);
          const extMatch = spXml.match(/<a:ext cx="([\d.]+)" cy="([\d.]+)"/);
          const x = offMatch ? parseFloat(offMatch[1]) / 9525 : 0;
          const y = offMatch ? parseFloat(offMatch[2]) / 9525 : 0;
          const w = extMatch ? parseFloat(extMatch[1]) / 9525 : 0;
          const h = extMatch ? parseFloat(extMatch[2]) / 9525 : 0;

          const txBodyMatch = spXml.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
          if (!txBodyMatch) continue;
          const txBodyXml = txBodyMatch[1];

          const embedMatch = txBodyXml.match(/<a:blip\s+r:embed="([^"]+)"/);
          if (embedMatch) {
            const imgData = await resolveImage(embedMatch[1]);
            if (imgData) {
              elements.push({
                type: 'image',
                data: imgData.data,
                filename: imgData.filename,
                x, y, w, h,
                name: (nameMatch ? nameMatch[1] : '') || 'Image'
              });
            }
          }

          const pRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
          let pMatch;
          while ((pMatch = pRegex.exec(txBodyXml)) !== null) {
            const pXml = pMatch[1];
            const rRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
            let rMatch;
            const runs = [];
            while ((rMatch = rRegex.exec(pXml)) !== null) {
              runs.push({ text: textFromRuns(rMatch[1]), ...formatFromRun(rMatch[1]) });
            }
            const text = runs.map(r => r.text).join('');
            if (!text) continue;
            const runFmt = runs[0];
            elements.push({
              type: 'text',
              text,
              x, y, w, h,
              size: runFmt ? runFmt.size : 18,
              bold: runFmt ? runFmt.bold : false,
              color: runFmt ? runFmt.color : '#334155'
            });
            if (phType === 'title' && !titleText.text) {
              titleText.text = text;
              titleText.size = runFmt ? runFmt.size : 18;
              titleText.bold = runFmt ? runFmt.bold : false;
              titleText.color = runFmt ? runFmt.color : '#1e293b';
            } else if (phType === 'subTitle' && !subtitleText.text) {
              subtitleText.text = text;
              subtitleText.size = runFmt ? runFmt.size : 18;
              subtitleText.bold = runFmt ? runFmt.bold : false;
              subtitleText.color = runFmt ? runFmt.color : '#475569';
            }
          }
        }

        slides.push({
          title: titleText.text,
          subtitle: subtitleText.text,
          titleSize: titleText.size,
          subtitleSize: subtitleText.size,
          titleBold: titleText.bold,
          background,
          textColor,
          elements
        });
      }
      index++;
    }

    if (slides.length === 0) {
      slides.push({ title: 'Imported Presentation', subtitle: '', elements: [] });
    }

    return new PptxPresentation({ slides });
  }
}

module.exports = PptxPresentation;
