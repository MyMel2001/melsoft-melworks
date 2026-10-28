// MelLite Automated Check Test
const assert = require('assert');
const { MelLiteFilterEngine, FilterEngine } = require('./src/filters');

function runTests() {
  console.log('Testing MelLite Photo Development engine...');

  // 1. Test MelLite exposure adjustment (1 stop = double brightness)
  const exposureImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const exposureOut = MelLiteFilterEngine.applyExposure(exposureImg, 1);
  assert.strictEqual(exposureOut.data[0], 200, 'MelLite exposure 1 stop doubles brightness');
  console.log('✓ MelLite exposure adjustment validated');

  // 2. Test MelLite contrast adjustment (contrast=255 => scale factor 2)
  const contrastImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const contrastOut = MelLiteFilterEngine.applyContrast(contrastImg, 255);
  assert.strictEqual(contrastOut.data[0], 72, 'MelLite contrast 255 scales deviation from neutral gray');
  console.log('✓ MelLite contrast adjustment validated');

  // 3. Test MelLite brightness adjustment (additive offset)
  const brightnessImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const brightnessOut = MelLiteFilterEngine.applyBrightness(brightnessImg, 10);
  assert.strictEqual(brightnessOut.data[0], 110, 'MelLite brightness adds offset');
  console.log('✓ MelLite brightness adjustment validated');

  // 4. Test MelLite saturation adjustment (gray stays neutral, chroma scales)
  const satImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 50, 50, 255]) };
  const satBefore = [satImg.data[0], satImg.data[1], satImg.data[2]];
  const satOut = MelLiteFilterEngine.applySaturation(satImg, 2);
  assert.ok(satOut.data[0] > satBefore[0] || satOut.data[1] < satBefore[1], 'MelLite saturation changes color values');
  const grayImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const grayOut = MelLiteFilterEngine.applySaturation(grayImg, 2);
  assert.strictEqual(grayOut.data[0], 100, 'MelLite saturation keeps neutral gray');
  console.log('✓ MelLite saturation adjustment validated');

  // 5. Test MelLite white balance adjustment (per-channel gain)
  const wbImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const wbOut = MelLiteFilterEngine.applyWhiteBalance(wbImg, { r: 2, g: 1, b: 1 });
  assert.strictEqual(wbOut.data[0], 200, 'MelLite white balance scales red channel');
  console.log('✓ MelLite white balance adjustment validated');

  // 6. Test MelLite full development pipeline (exposure -> contrast -> brightness -> saturation -> WB -> curves)
  const pipeImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const pipeOut = MelLiteFilterEngine.apply(pipeImg, { exposure: 1, contrast: 0, brightness: 0, saturation: 1, whiteBalance: { r: 1, g: 1, b: 1 } });
  assert.strictEqual(pipeOut.data[0], 200, 'MelLite full pipeline applies exposure');
  console.log('✓ MelLite full development pipeline validated');

  // 7. Test MelLite curves delegation through the shared FilterEngine
  const curveImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const curveOut = MelLiteFilterEngine.apply(curveImg, { curves: { points: [{ input: 0, output: 0 }, { input: 255, output: 255 }] } });
  assert.strictEqual(curveOut.data[0], 100, 'MelLite curves delegate to identity mapping');
  console.log('✓ MelLite curves delegation validated');

  // 8. Test MelLite RAW import (uncompressed DNG/TIFF baseline reader)
  const { MelRawImportEngine } = require('./src/raw');
  const W = 4;
  const H = 2;
  const stripLen = W * H * 3 * 2; // 16-bit RGB strip
  const strip = new Uint8Array(stripLen);
  const dv = new DataView(strip.buffer);
  const put16 = (px, ch, v) => { dv.setUint16(px * 6 + ch * 2, v, true); };
  put16(0, 0, 1000); put16(0, 1, 2000); put16(0, 2, 3000);
  put16(1, 0, 65535); put16(1, 1, 0); put16(1, 2, 32768);

  const entries = [
    { tag: 256, type: 4, count: 1, value: W },
    { tag: 257, type: 4, count: 1, value: H },
    { tag: 258, type: 3, count: 1, value: 16 },
    { tag: 259, type: 3, count: 1, value: 1 },
    { tag: 262, type: 3, count: 1, value: 2 },
    { tag: 273, type: 4, count: 1, value: 122 },
    { tag: 277, type: 3, count: 1, value: 3 },
    { tag: 278, type: 3, count: 1, value: H },
    { tag: 279, type: 4, count: 1, value: stripLen }
  ];
  const dng = new Uint8Array(122 + stripLen);
  dng[0] = 0x49; dng[1] = 0x49; // II
  dng[2] = 42; dng[3] = 0; // magic 42 LE
  dng[4] = 8; dng[5] = 0; dng[6] = 0; dng[7] = 0; // IFD0 offset = 8
  let ifdOff = 8;
  dng[ifdOff] = 9; dng[ifdOff + 1] = 0; // entry count
  let p = ifdOff + 2;
  for (const e of entries) {
    dng[p] = e.tag & 0xff; dng[p + 1] = Math.floor(e.tag / 256) & 0xff; // tag LE
    dng[p + 2] = e.type & 0xff; dng[p + 3] = Math.floor(e.type / 256) & 0xff;
    dng[p + 4] = e.count & 0xff; dng[p + 5] = Math.floor(e.count / 256) & 0xff;
    dng[p + 6] = e.value & 0xff; dng[p + 7] = Math.floor(e.value / 256) & 0xff;
    dng[p + 8] = e.value & 0xff; dng[p + 9] = Math.floor(e.value / 256) & 0xff;
    dng[p + 10] = 0; dng[p + 11] = 0;
    p += 12;
  }
  dng[118] = 0; dng[119] = 0; dng[120] = 0; dng[121] = 0; // next IFD = 0
  dng.set(strip, 122);

  const raw = MelRawImportEngine.parseDng(dng);
  assert.strictEqual(raw.width, W, 'MelLite RAW parse reads width');
  assert.strictEqual(raw.height, H, 'MelLite RAW parse reads height');
  assert.strictEqual(raw.compression, 1, 'MelLite RAW parse reads compression');
  const rgba = MelRawImportEngine.toRGBA(raw);
  assert.strictEqual(rgba.width, W, 'MelLite RAW toRGBA keeps width');
  assert.strictEqual(rgba.height, H, 'MelLite RAW toRGBA keeps height');
  assert.strictEqual(rgba.data.length, W * H * 4, 'MelLite RAW toRGBA produces RGBA buffer');
  assert.strictEqual(rgba.data[3], 255, 'MelLite RAW toRGBA alpha opaque');
  assert.strictEqual(rgba.data[0], 4, 'MelLite RAW toRGBA scales 16-bit red to 8-bit');
  assert.strictEqual(rgba.data[1], 8, 'MelLite RAW toRGBA scales 16-bit green to 8-bit');
  assert.strictEqual(rgba.data[2], 12, 'MelLite RAW toRGBA scales 16-bit blue to 8-bit');
  let rawErr = false;
  try { MelRawImportEngine.parseDng(new Uint8Array([0, 1])); } catch (e) { rawErr = true; }
  assert.ok(rawErr, 'MelLite RAW reader rejects short files');
  console.log('✓ MelLite RAW import engine validated');

  console.log('\nALL MELITE TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
