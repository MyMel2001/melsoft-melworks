// MelFilm Project Bundle Engine - ZIP bundles of Adobe post-production project files (.aepx / .prproj).
const { createRequire } = require('module');
const path = require('path');
const zlib = require('zlib');
const melOfficeRequire = createRequire(path.join(__dirname, '..', '..', 'mel-office', 'package.json'));
const JSZip = melOfficeRequire('jszip');

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
