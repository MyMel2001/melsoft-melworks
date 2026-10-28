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

  // 9. Test MelLite crop adjustment (region { x, y, width, height } pixels)
  const cropImg = { width: 4, height: 2, data: new Uint8ClampedArray(8 * 4) };
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 4; x++) {
      const o = (y * 4 + x) * 4;
      cropImg.data[o] = x * 10 + y * 3 + 1;
      cropImg.data[o + 1] = x * 7 + y * 5 + 2;
      cropImg.data[o + 2] = x * 3 + y * 2 + 3;
      cropImg.data[o + 3] = 255;
    }
  }
  const cropOut = MelLiteFilterEngine.apply(cropImg, { crop: { x: 1, y: 0, width: 2, height: 2 } });
  assert.strictEqual(cropOut.width, 2, 'MelLite crop computes new width');
  assert.strictEqual(cropOut.height, 2, 'MelLite crop computes new height');
  assert.strictEqual(cropOut.data.length, 2 * 2 * 4, 'MelLite crop computes new buffer size');
  assert.strictEqual(cropOut.data[0], 11, 'MelLite crop picks source pixel red at x=1');
  assert.strictEqual(cropOut.data[4], 21, 'MelLite crop picks source pixel red at x=2');
  assert.strictEqual(cropOut.data[8], 14, 'MelLite crop picks source pixel red at y=1');
  assert.strictEqual(cropOut.data[12], 24, 'MelLite crop picks source pixel red at x=2 y=1');
  console.log('✓ MelLite crop adjustment validated');

  // 10. Test MelLite rotate adjustment (90/180/270 degree rotations)
  const rot90 = MelLiteFilterEngine.applyRotate(cropImg, 90);
  assert.strictEqual(rot90.width, 2, 'MelLite rotate 90 swaps dims');
  assert.strictEqual(rot90.height, 4, 'MelLite rotate 90 swaps dims');
  assert.strictEqual(rot90.data[0], 4, 'MelLite rotate 90 maps source correctly');
  const rot180 = MelLiteFilterEngine.applyRotate(cropImg, 180);
  assert.strictEqual(rot180.width, 4, 'MelLite rotate 180 keeps dims');
  assert.strictEqual(rot180.height, 2, 'MelLite rotate 180 keeps dims');
  assert.strictEqual(rot180.data[0], 34, 'MelLite rotate 180 maps source correctly');
  const rot270 = MelLiteFilterEngine.applyRotate(cropImg, 270);
  assert.strictEqual(rot270.width, 2, 'MelLite rotate 270 swaps dims');
  assert.strictEqual(rot270.data[0], 31, 'MelLite rotate 270 maps source correctly');
  console.log('✓ MelLite rotate adjustment validated');

  // 11. Test MelLite sharpen adjustment (gain-based unsharp strength)
  const sharpImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const sharpOut = MelLiteFilterEngine.applySharpen(sharpImg, 1);
  assert.strictEqual(sharpOut.data[0], 200, 'MelLite sharpen applies gain');
  console.log('✓ MelLite sharpen adjustment validated');

  // 12. Test MelLite red-eye reduction (red dominance fix)
  const eyeImg = { width: 1, height: 1, data: new Uint8ClampedArray([200, 90, 70, 255]) };
  const eyeOut = MelLiteFilterEngine.applyRedEye(eyeImg);
  assert.strictEqual(eyeOut.data[0], 90, 'MelLite red-eye reduction neutralizes red');
  const clearEye = { width: 1, height: 1, data: new Uint8ClampedArray([60, 60, 60, 255]) };
  const clearOut = MelLiteFilterEngine.applyRedEye(clearEye);
  assert.strictEqual(clearOut.data[0], 60, 'MelLite red-eye reduction leaves neutral face alone');
  console.log('✓ MelLite red-eye reduction validated');

  // 13. Test MelLite film grain (amount-scaled noise)
  const grainImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const grainOut = MelLiteFilterEngine.applyGrain(grainImg, 0.5);
  assert.ok(grainOut.data[0] !== 100, 'MelLite grain adds noise');
  const noGrain = MelLiteFilterEngine.applyGrain({ width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) }, 0);
  assert.strictEqual(noGrain.data[0], 100, 'MelLite grain neutral at zero amount');
  console.log('✓ MelLite film grain validated');

  // 14. Test MelLite vignette (edge darkening)
  const vigImg = { width: 3, height: 3, data: new Uint8ClampedArray(9 * 4) };
  for (let i = 0; i < vigImg.data.length; i += 4) { vigImg.data[i] = 200; vigImg.data[i + 1] = 200; vigImg.data[i + 2] = 200; vigImg.data[i + 3] = 255; }
  const vigOut = MelLiteFilterEngine.applyVignette(vigImg, 0.5);
  assert.ok(vigOut.data[0] < 200, 'MelLite vignette darkens edges');
  const noVig = MelLiteFilterEngine.applyVignette({ width: 3, height: 3, data: (() => { const b = new Uint8ClampedArray(9 * 4); for (let i = 0; i < b.length; i += 4) { b[i] = 200; b[i+1] = 200; b[i+2] = 200; b[i+3] = 255; } return b; })() }, 0);
  assert.strictEqual(noVig.data[0], 200, 'MelLite vignette neutral at zero strength');
  console.log('✓ MelLite vignette validated');

  // 15. Test MelLite highlight roll-off (highlight compression)
  const hlImg = { width: 1, height: 1, data: new Uint8ClampedArray([255, 200, 100, 255]) };
  const hlOut = MelLiteFilterEngine.applyHighlightRollOff(hlImg, 250, 0.5);
  assert.strictEqual(hlOut.data[0], 253, 'MelLite highlight roll-off compresses clipped highlights');
  const hlLow = MelLiteFilterEngine.applyHighlightRollOff({ width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) }, 250, 0.5);
  assert.strictEqual(hlLow.data[0], 100, 'MelLite highlight roll-off leaves low values alone');
  console.log('✓ MelLite highlight roll-off validated');

  console.log('\nALL MELITE TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
