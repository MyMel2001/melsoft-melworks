// MelCAD Pro Automated Test Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DwgParser = require('./src/dwg');
const { DxfDocument } = require('./src/dxf');
const { CadEngine, CAD_BLOCKS } = require('./src/cad-engine');

console.log('Testing MelCAD Pro CAD Suite...');

// 1. DWG Parser Verification with Reference Cleanroom Files
console.log('\n--- 1. Testing DWG Binary Parser ---');

// Test 1.1: AC1015 DWG (Door 90 frame 600 wide left.dwg)
const dwgPath1 = path.join(__dirname, '..', 'cleanroom-helpers', 'cad-dwgs', 'Door 90 frame 600 wide left.dwg');
assert(fs.existsSync(dwgPath1), `Reference DWG exists: ${dwgPath1}`);
const dwgBuf1 = fs.readFileSync(dwgPath1);
const parsedDwg1 = DwgParser.parse(dwgBuf1);

assert.strictEqual(parsedDwg1.version, 'AC1015', 'DWG Version is AC1015');
assert.strictEqual(parsedDwg1.hasPreview, true, 'DWG contains preview sentinel and image');
assert(parsedDwg1.preview !== null, 'Preview object decoded');
assert.strictEqual(parsedDwg1.preview.width, 180, 'Preview width is 180');
assert.strictEqual(parsedDwg1.preview.height, 110, 'Preview height is 110');
assert.strictEqual(parsedDwg1.preview.bitCount, 8, 'Preview bitCount is 8 (256 colors)');
assert(parsedDwg1.preview.dataUrl.startsWith('data:image/bmp;base64,Qk'), 'Data URL is valid base64 BMP');
console.log('✔ AC1015 DWG parsing & 256-color BMP preview passed (Door 90 frame 600 wide)');

// Test 1.2: AC1018 DWG (3ft0in Single Door.DWG)
const dwgPath2 = path.join(__dirname, '..', 'cleanroom-helpers', 'cad-dwgs', '3ft-single-and-double-swing-doors-plan-view', '3ft0in Single Door.DWG');
assert(fs.existsSync(dwgPath2), `Reference DWG exists: ${dwgPath2}`);
const dwgBuf2 = fs.readFileSync(dwgPath2);
const parsedDwg2 = DwgParser.parse(dwgBuf2);

assert.strictEqual(parsedDwg2.version, 'AC1018', 'DWG Version is AC1018');
assert.strictEqual(parsedDwg2.hasPreview, true, 'DWG contains preview');
assert.strictEqual(parsedDwg2.preview.width, 180, 'Preview width is 180');
assert.strictEqual(parsedDwg2.preview.height, 111, 'Preview height is 111');
console.log('✔ AC1018 DWG parsing passed (3ft0in Single Door)');

// Test 1.3: AC1015 DWG (Compressor.dwg)
const dwgPath3 = path.join(__dirname, '..', 'cleanroom-helpers', 'cad-dwgs', 'Compressor.dwg');
assert(fs.existsSync(dwgPath3), `Reference DWG exists: ${dwgPath3}`);
const dwgBuf3 = fs.readFileSync(dwgPath3);
const parsedDwg3 = DwgParser.parse(dwgBuf3);

assert.strictEqual(parsedDwg3.version, 'AC1015', 'DWG Version is AC1015');
assert.strictEqual(parsedDwg3.hasPreview, true, 'DWG contains preview');
assert.strictEqual(parsedDwg3.preview.width, 184, 'Preview width is 184');
assert.strictEqual(parsedDwg3.preview.height, 70, 'Preview height is 70');
console.log('✔ AC1015 DWG parsing passed (Compressor)');

// 2. DXF Reader & Writer Roundtrip Verification
console.log('\n--- 2. Testing AutoCAD DXF Roundtrip ---');

const originalDoc = new DxfDocument({
  layers: [
    { name: '0', color: 7 },
    { name: 'WALLS', color: 2 },
    { name: 'DOORS', color: 4 },
    { name: 'DIMENSIONS', color: 1 }
  ],
  entities: [
    { type: 'LINE', layer: 'WALLS', color: 2, x1: 0, y1: 0, x2: 120, y2: 0 },
    { type: 'CIRCLE', layer: 'DOORS', color: 4, cx: 50, cy: 50, radius: 25 },
    { type: 'ARC', layer: 'DOORS', color: 4, cx: 0, cy: 0, radius: 36, startAngle: 0, endAngle: 90 },
    {
      type: 'LWPOLYLINE',
      layer: 'WALLS',
      color: 2,
      closed: true,
      vertices: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 30 },
        { x: 0, y: 30 }
      ]
    },
    { type: 'TEXT', layer: '0', color: 7, x: 10, y: 20, height: 12, text: 'MELCAD SPEC' },
    { type: 'DIMENSION', layer: 'DIMENSIONS', color: 1, x1: 0, y1: 0, x2: 36, y2: 0, text: '36.00"' }
  ]
});

const dxfString = originalDoc.toDxf();
assert(typeof dxfString === 'string', 'DXF output is string');
assert(dxfString.includes('SECTION\n2\nHEADER'), 'DXF contains HEADER section');
assert(dxfString.includes('AC1015'), 'DXF specified AC1015 AutoCAD standard');
assert(dxfString.includes('SECTION\n2\nTABLES'), 'DXF contains TABLES section');
assert(dxfString.includes('SECTION\n2\nENTITIES'), 'DXF contains ENTITIES section');
assert(dxfString.endsWith('0\nEOF\n'), 'DXF ends with standard 0 EOF');

// Parse DXF back
const parsedDoc = DxfDocument.parse(dxfString);
assert(parsedDoc.layers.length >= 4, `Parsed ${parsedDoc.layers.length} layers (expected >= 4)`);
assert.strictEqual(parsedDoc.entities.length, 6, `Parsed ${parsedDoc.entities.length} entities (expected 6)`);

// Verify entity properties
const lineEnt = parsedDoc.entities.find(e => e.type === 'LINE');
assert(lineEnt, 'Parsed LINE entity exists');
assert.strictEqual(lineEnt.layer, 'WALLS', 'LINE layer is WALLS');
assert.strictEqual(lineEnt.x1, 0, 'LINE x1 is 0');
assert.strictEqual(lineEnt.x2, 120, 'LINE x2 is 120');

const circleEnt = parsedDoc.entities.find(e => e.type === 'CIRCLE');
assert(circleEnt, 'Parsed CIRCLE entity exists');
assert.strictEqual(circleEnt.cx, 50, 'CIRCLE cx is 50');
assert.strictEqual(circleEnt.radius, 25, 'CIRCLE radius is 25');

const arcEnt = parsedDoc.entities.find(e => e.type === 'ARC');
assert(arcEnt, 'Parsed ARC entity exists');
assert.strictEqual(arcEnt.startAngle, 0, 'ARC startAngle is 0');
assert.strictEqual(arcEnt.endAngle, 90, 'ARC endAngle is 90');

const polyEnt = parsedDoc.entities.find(e => e.type === 'LWPOLYLINE');
assert(polyEnt, 'Parsed LWPOLYLINE entity exists');
assert.strictEqual(polyEnt.closed, true, 'LWPOLYLINE is closed');
assert.strictEqual(polyEnt.vertices.length, 4, 'LWPOLYLINE has 4 vertices');

const textEnt = parsedDoc.entities.find(e => e.type === 'TEXT');
assert(textEnt, 'Parsed TEXT entity exists');
assert.strictEqual(textEnt.text, 'MELCAD SPEC', 'TEXT content matches');

const dimEnt = parsedDoc.entities.find(e => e.type === 'DIMENSION');
assert(dimEnt, 'Parsed DIMENSION entity exists');
assert.strictEqual(dimEnt.text, '36.00"', 'DIMENSION label matches');
console.log('✔ AutoCAD DXF reader/writer roundtrip passed');

// 3. CAD Engine & Cleanroom Helpers Library Verification
console.log('\n--- 3. Testing CAD Engine & Cleanroom Blocks ---');

assert(CAD_BLOCKS['3ft_Single_Door'], '3ft Single Door block exists');
assert(CAD_BLOCKS['Door_90_Frame_600'], 'Door 90 Frame 600 block exists');
assert(CAD_BLOCKS['Computer_Workstation'], 'Computer Workstation block exists');
assert(CAD_BLOCKS['Compressor_Unit'], 'Compressor Unit block exists');

const testEntities = CAD_BLOCKS['3ft_Single_Door'].entities;
const bbox = CadEngine.boundingBox(testEntities);
assert(bbox.width >= 40, `Bounding box width is valid: ${bbox.width}`);
assert(bbox.height >= 36, `Bounding box height is valid: ${bbox.height}`);

const svg = CadEngine.exportSvg(testEntities, 800, 600);
assert(svg.includes('<svg'), 'SVG export produces <svg>');
assert(svg.includes('<line'), 'SVG export includes <line>');
assert(svg.includes('<path'), 'SVG export includes <path> arc');
console.log('✔ CAD Engine bounding box calculation & SVG export passed');

console.log('\n======================================');
console.log('ALL MELCAD PRO TESTS PASSED SUCCESSFULLY!');
console.log('======================================');
