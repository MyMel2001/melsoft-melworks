// MelFilm Project Bundle Engine - ZIP bundles of Adobe post-production project files (.aepx / .prproj).
const { createRequire } = require('module');
const path = require('path');
const zlib = require('zlib');
let JSZip;
try {
  JSZip = require('jszip');
} catch (e) {
  try {
    const melOfficeRequire = createRequire(path.join(__dirname, '..', '..', 'mel-office', 'package.json'));
    JSZip = melOfficeRequire('jszip');
  } catch (e2) {
    JSZip = (typeof window !== 'undefined') ? window.JSZip : null;
  }
}

class MelFilmBundle {
  static async saveAepx(projectName, xml) {
    const zip = new JSZip();
    zip.file('project.aepx', xml);
    zip.file('manifest.json', JSON.stringify({ app: 'mel-film', project: projectName, format: 'aepx' }));
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    return content;
  }

  static async savePrproj(projectName, xml) {
    const compressed = zlib.gzipSync(Buffer.from(xml, 'utf8'));
    const zip = new JSZip();
    zip.file('project.prproj', compressed.toString('base64'));
    zip.file('manifest.json', JSON.stringify({ app: 'mel-film', project: projectName, format: 'prproj' }));
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    return content;
  }

  static buildAepxXml(name, comps) {
    const compositions = (Array.isArray(comps) ? comps : []).map((c) => {
      const layers = (c.layers || []).map((l) => '<Layer id="' + (l.id || '') + '" name="' + (l.name || '') + '">' + (l.source ? '<Source filepath="' + l.source + '"/>' : '') + '</Layer>');
      return '<Composition name="' + (c.name || '') + '" width="' + (c.width || 1920) + '" height="' + (c.height || 1080) + '" frameRate="' + (c.frameRate || 24) + '">' + layers.join('') + '</Composition>';
    }).join('');
    return '<?xml version="1.0"?><Project><Name>' + (name || '') + '</Name><Compositions>' + compositions + '</Compositions></Project>';
  }

  static buildPrprojXml(name, comps) {
    const sequences = (Array.isArray(comps) ? comps : []).map((c) => {
      const layers = (c.layers || []).map((l) => '<Layer name="' + (l.name || '') + '">' + (l.source ? '<Source path="' + l.source + '"/>' : '') + '</Layer>');
      return '<Sequence name="' + (c.name || '') + '" duration="' + (((Number(c.frameCount) || 0)) / (Number(c.frameRate) || 24)) + 's">' + layers.join('') + '</Sequence>';
    }).join('');
    return '<?xml version="1.0"?><Project><Name>' + (name || '') + '</Name><Sequences>' + sequences + '</Sequences></Project>';
  }

  static async loadBundle(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const files = {};
    const entries = Object.keys(zip.files);
    for (const name of entries) {
      const entry = zip.files[name];
      if (entry.dir) continue;
      const data = await entry.async('arrayBuffer');
      files[name] = Buffer.from(data).toString('utf8');
    }
    return { files };
  }
}

module.exports = { MelFilmBundle };
