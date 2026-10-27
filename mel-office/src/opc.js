// MelOffice Open Packaging Conventions (ECMA-376-2) Helper
const JSZip = require('jszip');

class OPCContainer {
  constructor() {
    this.zip = new JSZip();
    this.contentTypes = new Map();
    this.overrides = new Map();
    this.relationships = [];
  }

  static async load(buffer) {
    const container = new OPCContainer();
    container.zip = await JSZip.loadAsync(buffer);
    return container;
  }

  addFile(path, content) {
    this.zip.file(path, content);
  }

  async getFile(path) {
    const file = this.zip.file(path);
    if (!file) return null;
    return await file.async('text');
  }

  async getBinaryFile(path) {
    const file = this.zip.file(path);
    if (!file) return null;
    return await file.async('uint8array');
  }

  addDefaultContentType(extension, contentType) {
    this.contentTypes.set(extension.toLowerCase(), contentType);
  }

  addOverrideContentType(partName, contentType) {
    const norm = partName.startsWith('/') ? partName : '/' + partName;
    this.overrides.set(norm, contentType);
  }

  addRelationship(id, type, target) {
    this.relationships.push({ id, type, target });
  }

  buildContentTypesXml() {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    xml += `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n`;
    for (const [ext, ct] of this.contentTypes.entries()) {
      xml += `  <Default Extension="${ext}" ContentType="${ct}"/>\n`;
    }
    for (const [part, ct] of this.overrides.entries()) {
      xml += `  <Override PartName="${part}" ContentType="${ct}"/>\n`;
    }
    xml += `</Types>`;
    return xml;
  }

  buildRelsXml(rels) {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
    xml += `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n`;
    for (const rel of rels) {
      xml += `  <Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>\n`;
    }
    xml += `</Relationships>`;
    return xml;
  }

  async exportBuffer() {
    if (this.contentTypes.size > 0 || this.overrides.size > 0) {
      this.zip.file('[Content_Types].xml', this.buildContentTypesXml());
    }
    if (this.relationships.length > 0) {
      this.zip.file('_rels/.rels', this.buildRelsXml(this.relationships));
    }
    return await this.zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}

module.exports = OPCContainer;
