// MelLite Automated Check Test
const assert = require('assert');
const os = require('os');
const path = require('path');
const { MelLiteFilterEngine, FilterEngine } = require('./src/filters');

async function runTests() {
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
    dng[p + 6] = 0; dng[p + 7] = 0;
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

  // 8. Test MelLite RAW import of uncompressed 8-bit baseline TIFF
  const W8 = 2;
  const H8 = 1;
  const strip8 = new Uint8Array(W8 * H8 * 3);
  strip8[0] = 100; strip8[1] = 150; strip8[2] = 200;
  strip8[3] = 10; strip8[4] = 20; strip8[5] = 30;
  const entries8 = [
    { tag: 256, type: 4, count: 1, value: W8 },
    { tag: 257, type: 4, count: 1, value: H8 },
    { tag: 258, type: 3, count: 1, value: 8 },
    { tag: 259, type: 3, count: 1, value: 1 },
    { tag: 277, type: 3, count: 1, value: 3 },
    { tag: 273, type: 4, count: 1, value: 122 },
    { tag: 279, type: 4, count: 1, value: strip8.length }
  ];
  const dng8 = new Uint8Array(122 + strip8.length);
  dng8[0] = 0x49; dng8[1] = 0x49; dng8[2] = 42; dng8[3] = 0;
  dng8[4] = 8; dng8[5] = 0; dng8[6] = 0; dng8[7] = 0;
  dng8[8] = 9; dng8[9] = 0;
  let p8 = 10;
  for (const e of entries8) {
    dng8[p8] = e.tag & 0xff; dng8[p8 + 1] = Math.floor(e.tag / 256) & 0xff;
    dng8[p8 + 2] = e.type & 0xff; dng8[p8 + 3] = Math.floor(e.type / 256) & 0xff;
    dng8[p8 + 4] = e.count & 0xff; dng8[p8 + 5] = Math.floor(e.count / 256) & 0xff;
    dng8[p8 + 6] = 0; dng8[p8 + 7] = 0;
    dng8[p8 + 8] = e.value & 0xff; dng8[p8 + 9] = Math.floor(e.value / 256) & 0xff;
    dng8[p8 + 10] = 0; dng8[p8 + 11] = 0;
    p8 += 12;
  }
  dng8[118] = 0; dng8[119] = 0; dng8[120] = 0; dng8[121] = 0;
  dng8.set(strip8, 122);
  const raw8 = MelRawImportEngine.parseDng(dng8);
  assert.strictEqual(raw8.width, W8, 'MelLite RAW 8-bit parse reads width');
  assert.strictEqual(raw8.height, H8, 'MelLite RAW 8-bit parse reads height');
  assert.strictEqual(raw8.bitsPerSample, 8, 'MelLite RAW 8-bit parse reads bit depth');
  const rgba8 = MelRawImportEngine.toRGBA(raw8);
  assert.strictEqual(rgba8.width, W8, 'MelLite RAW 8-bit toRGBA keeps width');
  assert.strictEqual(rgba8.height, H8, 'MelLite RAW 8-bit toRGBA keeps height');
  assert.strictEqual(rgba8.data.length, W8 * H8 * 4, 'MelLite RAW 8-bit toRGBA produces RGBA buffer');
  assert.strictEqual(rgba8.data[0], 100, 'MelLite RAW 8-bit toRGBA passes red through');
  assert.strictEqual(rgba8.data[1], 150, 'MelLite RAW 8-bit toRGBA passes green through');
  assert.strictEqual(rgba8.data[2], 200, 'MelLite RAW 8-bit toRGBA passes blue through');
  assert.strictEqual(rgba8.data[4], 10, 'MelLite RAW 8-bit toRGBA passes second pixel red');

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

  // 16. Test MelLite local adjustments (brush region applies ops, outside keeps original)
  const localImg = { width: 3, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255]) };
  const localOut = MelLiteFilterEngine.applyLocalAdjustments(localImg, { x: 1, y: 0, width: 1, height: 1 }, { brightness: 10 });
  assert.strictEqual(localOut.width, 3, 'MelLite local adjustments keep width');
  assert.strictEqual(localOut.height, 1, 'MelLite local adjustments keep height');
  assert.strictEqual(localOut.data[0], 100, 'MelLite local adjustments outside region unchanged');
  assert.strictEqual(localOut.data[4], 110, 'MelLite local adjustments inside region shifted');
  assert.strictEqual(localOut.data[8], 100, 'MelLite local adjustments outside region right unchanged');
  const fullLocal = MelLiteFilterEngine.applyLocalAdjustments(localImg, { x: 0, y: 0, width: 3, height: 1 }, { brightness: 10 });
  assert.strictEqual(fullLocal.data[0], 110, 'MelLite local adjustments full region applies op');
  console.log('✓ MelLite local adjustments validated');

  // 17. Test MelLite FFMPEG backed decode to ImageData (ProRes RAW / FFMPEG-supported inputs)
  const { MelLiteFfmpeg, runFfmpeg } = require('./src/ffmpeg');
  const decSrc = path.join(os.tmpdir(), 'mel-lite-dec-src.mp4');
  const decOut = path.join(os.tmpdir(), 'mel-lite-dec-out.mp4');
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=10',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', decSrc
  ]);
  const decInfo = await MelLiteFfmpeg.probe(decSrc);
  assert.ok(decInfo.width > 0 && decInfo.height > 0, 'MelLite FFMPEG probe reads decoded video dimensions');
  const decImg = await MelLiteFfmpeg.decodeToImageData(decSrc);
  assert.strictEqual(decImg.width, decInfo.width, 'MelLite FFMPEG decode keeps width');
  assert.strictEqual(decImg.height, decInfo.height, 'MelLite FFMPEG decode keeps height');
  assert.strictEqual(decImg.data.length, decInfo.width * decInfo.height * 4, 'MelLite FFMPEG decode produces RGBA buffer');
  assert.strictEqual(decImg.data[3], 255, 'MelLite FFMPEG decode sets alpha opaque');
  console.log('✓ MelLite FFMPEG decode bridge validated');

  // 18. Test MelLite blur (box blur averages window)
  const blurImg = { width: 3, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255]) };
  const blurOut = MelLiteFilterEngine.applyBlur(blurImg, 1);
  assert.strictEqual(blurOut.width, 3, 'MelLite blur keeps width');
  assert.strictEqual(blurOut.height, 1, 'MelLite blur keeps height');
  assert.strictEqual(blurOut.data[4], 85, 'MelLite blur averages full window for interior pixel');
  assert.strictEqual(blurOut.data[3], 255, 'MelLite blur keeps alpha opaque');
  const blurId = MelLiteFilterEngine.applyBlur(blurImg, 0);
  assert.strictEqual(blurId.data[0], 0, 'MelLite blur neutral at radius 0');

  // 19. Test MelLite pixelate (block averaging)
  const pixImg = { width: 4, height: 1, data: new Uint8ClampedArray([10, 10, 10, 255, 20, 20, 20, 255, 30, 30, 30, 255, 40, 40, 40, 255]) };
  const pixOut = MelLiteFilterEngine.applyPixelate(pixImg, 2);
  assert.strictEqual(pixOut.width, 4, 'MelLite pixelate keeps width');
  assert.strictEqual(pixOut.height, 1, 'MelLite pixelate keeps height');
  assert.strictEqual(pixOut.data[0], 15, 'MelLite pixelate averages block of 2 -> 15');
  assert.strictEqual(pixOut.data[8], 35, 'MelLite pixelate averages second block -> 35');
  const pixId = MelLiteFilterEngine.applyPixelate(pixImg, 1);
  assert.strictEqual(pixId.data[0], 10, 'MelLite pixelate neutral at size 1');

  // 20. Test MelLite border (adds colored frame)
  const borderImg = { width: 1, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255]) };
  const borderOut = MelLiteFilterEngine.applyBorder(borderImg, { width: 1, color: { r: 0, g: 0, b: 0, a: 255 } });
  assert.strictEqual(borderOut.width, 3, 'MelLite border grows width by 2x frame');
  assert.strictEqual(borderOut.height, 3, 'MelLite border grows height by 2x frame');
  assert.strictEqual(borderOut.data[0], 0, 'MelLite border paints frame color');
  assert.strictEqual(borderOut.data[3], 255, 'MelLite border frame alpha opaque');
  assert.strictEqual(borderOut.data[16], 100, 'MelLite border keeps interior pixel');

  // 21. Test MelLite full pipeline integrates new filters
  const filtPipe = MelLiteFilterEngine.apply(blurImg, { blur: 1 });
  assert.strictEqual(filtPipe.data[4], 85, 'MelLite pipeline applies blur');
  const filtPipePix = MelLiteFilterEngine.apply(pixImg, { pixelate: 2 });
  assert.strictEqual(filtPipePix.data[0], 15, 'MelLite pipeline applies pixelate');
  const filtPipeBorder = MelLiteFilterEngine.apply(borderImg, { border: { width: 2, color: { r: 255, g: 0, b: 0, a: 255 } } });
  assert.strictEqual(filtPipeBorder.width, 5, 'MelLite pipeline applies border');
  assert.strictEqual(filtPipeBorder.data[0], 255, 'MelLite pipeline border frame color red');

  console.log('\nALL MELITE TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
