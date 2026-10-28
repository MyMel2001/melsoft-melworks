// MelDraw Automated Check Test
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PsdDocument, PackBits } = require('./src/psd');
const Filters = require('./src/filters');
const { SubjectSegmenter } = require('./src/segment');

async function runTests() {
  console.log('Testing MelDraw PSD binary and PackBits engines...');

  // 1. Test PackBits RLE Compression & Decompression
  const originalData = Buffer.from([
    10, 10, 10, 10, 10, // Run of 5
    1, 2, 3, 4, 5,       // Literal run of 5
    255, 255, 255, 255  // Run of 4
  ]);

  const compressed = PackBits.compress(originalData);
  assert(compressed.length < originalData.length, 'PackBits compressed data is smaller');

  const decompressed = PackBits.decompress(compressed, originalData.length);
  assert.deepStrictEqual(decompressed, originalData, 'PackBits decompression exact match');
  console.log('✓ PackBits RLE compression & decompression validated');

  // 2. Test Multi-Layer PSD Binary Generation
  const w = 200;
  const h = 150;
  const pixelCount = w * h;

  // Background layer (solid blue)
  const bgRgba = Buffer.alloc(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    bgRgba[i * 4] = 30;      // R
    bgRgba[i * 4 + 1] = 64;  // G
    bgRgba[i * 4 + 2] = 175; // B
    bgRgba[i * 4 + 3] = 255; // A
  }

  // Foreground layer (semi-transparent orange rect)
  const fgRgba = Buffer.alloc(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    fgRgba[i * 4] = 249;     // R
    fgRgba[i * 4 + 1] = 115; // G
    fgRgba[i * 4 + 2] = 22;  // B
    fgRgba[i * 4 + 3] = 180; // A
  }

  const psd = new PsdDocument({
    width: w,
    height: h,
    layers: [
      {
        name: 'Background',
        top: 0,
        left: 0,
        bottom: h,
        right: w,
        opacity: 255,
        blendMode: 'normal',
        visible: true,
        rgbaData: bgRgba
      },
      {
        name: 'Foreground Accent',
        top: 0,
        left: 0,
        bottom: h,
        right: w,
        opacity: 180,
        blendMode: 'multiply',
        visible: true,
        rgbaData: fgRgba
      }
    ]
  });

  const psdBuf = psd.toBuffer();
  assert(Buffer.isBuffer(psdBuf), 'PSD output is valid buffer');
  assert.strictEqual(psdBuf.slice(0, 4).toString('ascii'), '8BPS', 'Signature matches 8BPS');
  assert.strictEqual(psdBuf.readUInt16BE(4), 1, 'PSD version is 1');
  assert.strictEqual(psdBuf.readUInt32BE(14), h, 'PSD height matches');
  assert.strictEqual(psdBuf.readUInt32BE(18), w, 'PSD width matches');
  assert.strictEqual(psdBuf.readUInt16BE(22), 8, 'PSD depth is 8-bit');
  assert.strictEqual(psdBuf.readUInt16BE(24), 3, 'PSD color mode is RGB (3)');
  console.log('✓ PSD binary generation validated, file size:', psdBuf.length, 'bytes');

  // 3. Test PSD Binary Parsing & Roundtrip
  const parsedPsd = PsdDocument.parse(psdBuf);
  assert.strictEqual(parsedPsd.width, w, 'Parsed PSD width matches');
  assert.strictEqual(parsedPsd.height, h, 'Parsed PSD height matches');
  assert.strictEqual(parsedPsd.layers.length, 2, 'Parsed PSD has 2 layers');
  assert.strictEqual(parsedPsd.layers[0].name, 'Background', 'Layer 0 name matches');
  assert.strictEqual(parsedPsd.layers[1].name, 'Foreground Accent', 'Layer 1 name matches');
  assert.strictEqual(parsedPsd.layers[1].blendMode, 'multiply', 'Layer 1 blendMode matches multiply');

  // Check pixel channels roundtripped
  const l0R = parsedPsd.layers[0].rgbaData[0];
  const l0G = parsedPsd.layers[0].rgbaData[1];
  const l0B = parsedPsd.layers[0].rgbaData[2];
  assert.strictEqual(l0R, 30, 'Layer 0 Red matches');
  assert.strictEqual(l0G, 64, 'Layer 0 Green matches');
  assert.strictEqual(l0B, 175, 'Layer 0 Blue matches');
  console.log('✓ PSD parser and layer roundtrip validated');

  // 4. Test Curves adjustment engine
  const identityData = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  const identityResult = Filters.applyCurves({ width: 3, height: 1, data: identityData }, { points: [{ input: 0, output: 0 }, { input: 255, output: 255 }] });
  assert.strictEqual(identityResult.data[0], 0, 'Curves identity: black stays black');
  assert.strictEqual(identityResult.data[3], 255, 'Curves identity: alpha preserved');
  assert.strictEqual(identityResult.data[4], 128, 'Curves identity: mid gray stays mid gray');
  assert.strictEqual(identityResult.data[11], 255, 'Curves identity: white stays white');

  const brightened = Filters.applyCurves({ width: 3, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]) }, { points: [{ input: 0, output: 0 }, { input: 128, output: 255 }, { input: 255, output: 255 }] });
  assert.strictEqual(brightened.data[4], 255, 'Curves: input 128 maps to output 255');
  assert.strictEqual(brightened.data[7], 255, 'Curves: second pixel channels mapped');

  const channelData = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const redOnly = Filters.applyCurves({ width: 2, height: 1, data: channelData }, { points: [{ input: 0, output: 0 }, { input: 255, output: 255 }] }, 'r');
  assert.strictEqual(redOnly.data[0], 10, 'Curves channel R: identity keeps red');
  assert.strictEqual(redOnly.data[1], 20, 'Curves channel R: green untouched');
  assert.strictEqual(redOnly.data[2], 30, 'Curves channel R: blue untouched');
  console.log('✓ MelDraw Curves adjustment engine validated');

  // 5. Test Subject Segmentation engine (flood fill + color range masks)
  const segImg = { width: 4, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 200, 30, 30, 255, 40, 40, 40, 255]) };
  const flood = SubjectSegmenter.floodSelectMask(segImg, 0, 0, 5);
  assert.deepStrictEqual(Array.from(flood.mask), [1, 1, 0, 0], 'Flood select: black run selected, red excluded');
  assert.deepStrictEqual(flood.bounds, { x: 0, y: 0, width: 2, height: 1 }, 'Flood select: bounds correct');
  const colorSel = SubjectSegmenter.colorSelectMask(segImg, 200, 30, 30, 25);
  assert.deepStrictEqual(Array.from(colorSel.mask), [0, 0, 1, 0], 'Color select: red pixel selected, others excluded');
  assert.deepStrictEqual(colorSel.bounds, { x: 2, y: 0, width: 1, height: 1 }, 'Color select: bounds correct');
  console.log('✓ MelDraw Subject Segmentation engine validated');

  // Save sample PSD
  fs.mkdirSync(path.join(__dirname, 'samples'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'samples', 'sample.psd'), psdBuf);
  console.log('✓ Sample PSD generated in samples/sample.psd');

  console.log('\nALL MelDraw Studio TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
