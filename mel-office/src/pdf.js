// MelOffice PDF Editing Engine (pdf-lib backed)
// Supports loading existing PDFs, adding text overlays, embedding images, and saving.
const { PDFDocument, StandardFonts } = require('pdf-lib');

const PDF_MIME = 'application/pdf';

class MelPdfDocument {
  static async load(bytes) {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc;
  }

  static async create({ pageSize = { width: 595.28, height: 841.89 } } = {}) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([pageSize.width, pageSize.height]);
    return { doc, page };
  }

  static async addText(doc, { text, x, y, size = 12, pageIndex = 0, bold = false }) {
    const page = doc.getPage(pageIndex);
    const font = await doc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
    page.drawText(text, { x, y, size, font });
    return page;
  }

  static async addImage(doc, { imageBytes, x, y, width, height, pageIndex = 0 }) {
    const image = await doc.embedPng(imageBytes);
    const page = doc.getPage(pageIndex);
    page.drawImage(image, { x, y, width, height });
    return page;
  }

  static async save(doc) {
    return await doc.save();
  }

  static async saveToDataUrl(doc) {
    const bytes = await doc.save();
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return 'data:' + PDF_MIME + ';base64,' + btoa(bin);
  }

  static async loadFromDataUrl(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return MelPdfDocument.load(bytes);
  }
}

module.exports = { MelPdfDocument, PDFDocument, StandardFonts };
