// MelFlash Project (FLA / XFL) Encoder & Decoder
// Implements DOMDocument XFL standard & archive structure from cleanroom specification
const JSZipLib = (typeof JSZip !== 'undefined') ? JSZip : ((typeof require !== 'undefined') ? require('jszip') : (typeof window !== 'undefined' ? window.JSZip : null));

class FlaProject {
  constructor(options = {}) {
    this.name = options.name || 'Untitled-1';
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.frameRate = options.frameRate || 24;
    this.backgroundColor = options.backgroundColor || '#FFFFFF';
    this.actionScriptVersion = options.actionScriptVersion || '3';
    this.documentClass = options.documentClass || 'Main';
    this.layers = options.layers || [
      {
        name: 'Layer 1',
        locked: false,
        visible: true,
        frames: [
          {
            index: 0,
            duration: 1,
            isKeyframe: true,
            actions: '// Frame 1 Actions\nstop();',
            elements: [
              { type: 'rect', x: 100, y: 100, width: 140, height: 90, fill: '#FF6600', stroke: '#000000', strokeWidth: 2 }
            ]
          }
        ]
      }
    ];
    this.symbols = options.symbols || [
      {
        name: 'Symbol 1',
        type: 'movie clip', // 'movie clip', 'button', 'graphic'
        elements: [
          { type: 'circle', x: 0, y: 0, radius: 40, fill: '#3B82F6' }
        ]
      }
    ];
  }

  toXflXml() {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<DOMDocument xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://ns.adobe.com/xfl/2008/" `;
    xml += `width="${this.width}" height="${this.height}" frameRate="${this.frameRate}" backgroundColor="${this.backgroundColor}" actionScriptVersion="${this.actionScriptVersion}" currentLibraryItem="${this.documentClass}">\n`;

    // Symbols Library
    xml += `  <symbols>\n`;
    for (const sym of this.symbols) {
      xml += `    <Include href="${sym.name}.xml" itemIcon="1" loadImmediate="false"/>\n`;
    }
    xml += `  </symbols>\n`;

    // Timelines
    xml += `  <timelines>\n`;
    xml += `    <DOMTimeline name="Scene 1">\n`;
    xml += `      <layers>\n`;
    for (const layer of this.layers) {
      xml += `        <DOMLayer name="${layer.name}" color="#4F80FF" locked="${layer.locked}" visible="${layer.visible}">\n`;
      xml += `          <frames>\n`;
      for (const frame of layer.frames) {
        xml += `            <DOMFrame index="${frame.index}" duration="${frame.duration || 1}" keyMode="9728">\n`;
        if (frame.actions) {
          xml += `              <Actionscript><script><![CDATA[${frame.actions}]]></script></Actionscript>\n`;
        }
        xml += `              <elements>\n`;
        for (const el of (frame.elements || [])) {
          xml += `                <DOMShape>\n`;
          xml += `                  <fills><FillStyle index="1"><SolidColor color="${el.fill || '#000000'}"/></FillStyle></fills>\n`;
          xml += `                  <strokes><StrokeStyle index="1"><SolidStroke weight="${el.strokeWidth || 1}"><fill><SolidColor color="${el.stroke || '#000000'}"/></fill></SolidStroke></StrokeStyle></strokes>\n`;
          xml += `                  <geometry type="${el.type}" x="${el.x}" y="${el.y}" w="${el.width || 0}" h="${el.height || 0}" r="${el.radius || 0}"/>\n`;
          xml += `                </DOMShape>\n`;
        }
        xml += `              </elements>\n`;
        xml += `            </DOMFrame>\n`;
      }
      xml += `          </frames>\n`;
      xml += `        </DOMLayer>\n`;
    }
    xml += `      </layers>\n`;
    xml += `    </DOMTimeline>\n`;
    xml += `  </timelines>\n`;
    xml += `</DOMDocument>`;
    return xml;
  }

  async exportBuffer() {
    const zip = new JSZipLib();
    zip.file('DOMDocument.xml', this.toXflXml());

    // Write symbol files in LIBRARY/
    for (const sym of this.symbols) {
      let sXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      sXml += `<DOMSymbolItem xmlns="http://ns.adobe.com/xfl/2008/" name="${sym.name}" itemID="${Date.now()}" symbolType="${sym.type}">\n`;
      sXml += `  <timeline><DOMTimeline name="${sym.name}"><layers><DOMLayer name="Layer 1"><frames><DOMFrame index="0"><elements>\n`;
      for (const el of sym.elements) {
        sXml += `    <DOMShape type="${el.type}" fill="${el.fill || '#000'}"/>\n`;
      }
      sXml += `  </elements></DOMFrame></frames></DOMLayer></layers></DOMTimeline></timeline>\n`;
      sXml += `</DOMSymbolItem>`;
      zip.file(`LIBRARY/${sym.name}.xml`, sXml);
    }

    // Write cleanroom FLA metadata
    zip.file('Contents', `CDocumentPage P 1\nCMediaBits M 0\nCQTAudioSettings\n`);

    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  static async fromBuffer(buffer) {
    const zip = await JSZipLib.loadAsync(buffer);
    const docXml = await zip.file('DOMDocument.xml').async('text');

    const widthMatch = docXml.match(/width="([0-9]+)"/);
    const heightMatch = docXml.match(/height="([0-9]+)"/);
    const fpsMatch = docXml.match(/frameRate="([0-9\.]+)"/);
    const bgMatch = docXml.match(/backgroundColor="([^"]+)"/);
    const asMatch = docXml.match(/actionScriptVersion="([^"]+)"/);
    const docClassMatch = docXml.match(/currentLibraryItem="([^"]+)"/);

    const width = widthMatch ? parseInt(widthMatch[1], 10) : 800;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : 600;
    const frameRate = fpsMatch ? parseFloat(fpsMatch[1]) : 24;
    const backgroundColor = bgMatch ? bgMatch[1] : '#FFFFFF';
    const actionScriptVersion = asMatch ? asMatch[1] : '3';
    const documentClass = docClassMatch ? docClassMatch[1] : 'Main';

    const layers = [];
    const layerRegex = /<DOMLayer\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/DOMLayer>/g;
    let lm;
    while ((lm = layerRegex.exec(docXml)) !== null) {
      const lName = lm[1];
      const lBody = lm[2];
      const frames = [];

      const frameRegex = /<DOMFrame\s+index="([0-9]+)"[^>]*>([\s\S]*?)<\/DOMFrame>/g;
      let fm;
      while ((fm = frameRegex.exec(lBody)) !== null) {
        const fIdx = parseInt(fm[1], 10);
        const fBody = fm[2];

        let actions = '';
        const actMatch = fBody.match(/<script><!\[CDATA\[([\s\S]*?)\]\]><\/script>/);
        if (actMatch) actions = actMatch[1];

        const elements = [];
        const geomRegex = /<geometry\s+type="([^"]+)"\s+x="([0-9\.\-]+)"\s+y="([0-9\.\-]+)"\s+w="([0-9\.\-]+)"\s+h="([0-9\.\-]+)"/g;
        let gm;
        while ((gm = geomRegex.exec(fBody)) !== null) {
          elements.push({
            type: gm[1],
            x: parseFloat(gm[2]),
            y: parseFloat(gm[3]),
            width: parseFloat(gm[4]),
            height: parseFloat(gm[5]),
            fill: '#FF6600',
            stroke: '#000000',
            strokeWidth: 2
          });
        }

        frames.push({ index: fIdx, duration: 1, isKeyframe: true, actions, elements });
      }

      layers.push({ name: lName, locked: false, visible: true, frames: frames.length ? frames : [{ index: 0, duration: 1, isKeyframe: true, elements: [] }] });
    }

    if (layers.length === 0) {
      layers.push({ name: 'Layer 1', locked: false, visible: true, frames: [{ index: 0, duration: 1, isKeyframe: true, elements: [] }] });
    }

    return new FlaProject({ width, height, frameRate, backgroundColor, actionScriptVersion, documentClass, layers });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlaProject;
}
if (typeof window !== 'undefined') {
  window.FlaProject = FlaProject;
}
