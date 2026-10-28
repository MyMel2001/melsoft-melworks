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

  console.log('\nALL MELITE TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
