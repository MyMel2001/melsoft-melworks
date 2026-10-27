// MelOffice Automated Check Test
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DocxDocument = require('./src/docx');
const XlsxSpreadsheet = require('./src/xlsx');
const PptxPresentation = require('./src/pptx');

async function runTests() {
  console.log('Testing MelOffice 365 OpenXML engines...');

  // 1. Test MelWord DOCX Export & Import
  const sampleDoc = new DocxDocument({
    title: 'Executive Summary',
    artBorder: 'woodwork',
    paragraphs: [
      {
        style: 'Title',
        align: 'center',
        runs: [{ text: 'MelOffice Suite Architecture', bold: true, size: 36, color: '1A73E8' }]
      },
      {
        style: 'Normal',
        align: 'left',
        runs: [
          { text: 'Conforms strictly to ECMA-376 WordprocessingML standard.', bold: false, size: 24 },
          { text: ' Art borders: woodwork.', italic: true, bold: true, size: 24 }
        ]
      }
    ]
  });

  const docxBuf = await sampleDoc.exportBuffer();
  assert(Buffer.isBuffer(docxBuf) && docxBuf.length > 500, 'DOCX export buffer valid');
  assert(docxBuf.slice(0, 4).toString('hex') === '504b0304', 'DOCX is valid ZIP container (PK\x03\x04)');

  const parsedDoc = await DocxDocument.fromBuffer(docxBuf);
  assert.strictEqual(parsedDoc.paragraphs.length, 2, 'Parsed DOCX has 2 paragraphs');
  assert.strictEqual(parsedDoc.paragraphs[0].runs[0].text, 'MelOffice Suite Architecture', 'Parsed DOCX heading matches');
  console.log('✓ MelWord DOCX export & import validated');

  // 2. Test MelExcel XLSX Export, Formulas & Import
  const sampleSheet = new XlsxSpreadsheet({
    cells: {
      'A1': { value: 'Product' },
      'B1': { value: 'Cost' },
      'A2': { value: 'Keyboard' },
      'B2': { value: 50 },
      'A3': { value: 'Mouse' },
      'B3': { value: 30 },
      'A4': { value: 'Total' },
      'B4': { formula: 'SUM(B2:B3)' }
    }
  });

  const calcSum = sampleSheet.evaluateFormula('SUM(B2:B3)');
  assert.strictEqual(calcSum, 80, 'Formula SUM calculation correct');

  const calcMult = sampleSheet.evaluateFormula('B2*2');
  assert.strictEqual(calcMult, 100, 'Arithmetic formula calculation correct');

  const xlsxBuf = await sampleSheet.exportBuffer();
  assert(Buffer.isBuffer(xlsxBuf) && xlsxBuf.length > 500, 'XLSX export buffer valid');
  assert(xlsxBuf.slice(0, 4).toString('hex') === '504b0304', 'XLSX is valid ZIP container (PK\x03\x04)');

  const parsedSheet = await XlsxSpreadsheet.fromBuffer(xlsxBuf);
  assert.strictEqual(parsedSheet.cells['A2'].value, 'Keyboard', 'Parsed XLSX shared string matches');
  assert.strictEqual(parsedSheet.cells['B2'].value, 50, 'Parsed XLSX numeric value matches');
  console.log('✓ MelExcel XLSX export & calc engine validated');

  // 3. Test MelPowerPoint PPTX Export & Import
  const sampleDeck = new PptxPresentation({
    slides: [
      {
        title: 'MelOffice 2026',
        subtitle: 'PresentationML Validation',
        elements: [{ type: 'text', text: 'Slide content 1', size: 20 }]
      },
      {
        title: 'Roadmap & Standards',
        subtitle: 'ECMA-376 OpenXML',
        elements: [{ type: 'text', text: 'Slide content 2', size: 20 }]
      }
    ]
  });

  const pptxBuf = await sampleDeck.exportBuffer();
  assert(Buffer.isBuffer(pptxBuf) && pptxBuf.length > 500, 'PPTX export buffer valid');
  assert(pptxBuf.slice(0, 4).toString('hex') === '504b0304', 'PPTX is valid ZIP container (PK\x03\x04)');

  const parsedDeck = await PptxPresentation.fromBuffer(pptxBuf);
  assert.strictEqual(parsedDeck.slides.length, 2, 'Parsed PPTX has 2 slides');
  assert.strictEqual(parsedDeck.slides[0].title, 'MelOffice 2026', 'Parsed PPTX title matches');
  console.log('✓ MelPowerPoint PPTX export & import validated');

  // Save sample files
  fs.mkdirSync(path.join(__dirname, 'samples'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'samples', 'sample.docx'), docxBuf);
  fs.writeFileSync(path.join(__dirname, 'samples', 'sample.xlsx'), xlsxBuf);
  fs.writeFileSync(path.join(__dirname, 'samples', 'sample.pptx'), pptxBuf);
  console.log('✓ Sample OpenXML files generated in samples/');

  console.log('\nALL MelOffice 365 TESTS PASSED SUCCESFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
