// MelFlash Automated Check Test
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SwfMovie = require('./src/swf');
const FlaProject = require('./src/fla');

async function runTests() {
  console.log('Testing MelFlash binary SWF and FLA engines...');

  // 1. Test SWF Binary Generation
  const movie = new SwfMovie({
    version: 10,
    width: 640,
    height: 480,
    fps: 24,
    backgroundColor: { r: 15, g: 23, b: 42 },
    frames: [
      {
        elements: [
          { x: 100, y: 100, w: 120, h: 80, color: { r: 249, g: 115, b: 22 } }
        ],
        actions: ['stop']
      },
      {
        elements: [
          { x: 150, y: 120, w: 120, h: 80, color: { r: 59, g: 130, b: 246 } }
        ],
        actions: ['play']
      }
    ]
  });

  const swfBuf = movie.toBuffer();
  assert(Buffer.isBuffer(swfBuf), 'SWF export is valid Buffer');
  assert.strictEqual(swfBuf.slice(0, 3).toString('ascii'), 'FWS', 'SWF signature matches FWS');
  assert.strictEqual(swfBuf.readUInt8(3), 10, 'SWF version is 10');
  assert.strictEqual(swfBuf.readUInt32LE(4), swfBuf.length, 'SWF header length matches byte length');
  console.log('✓ SWF binary generator valid, output size:', swfBuf.length, 'bytes');

  // 2. Test SWF Parser / Disassembler
  const parsed = SwfMovie.parse(swfBuf);
  assert.strictEqual(parsed.signature, 'FWS');
  assert.strictEqual(parsed.version, 10);
  assert.strictEqual(parsed.fps, 24);
  assert.strictEqual(parsed.frameCount, 2);
  assert(parsed.tags.length >= 4, 'Parsed tags list populated');
  // Check that SetBackgroundColor (Tag 9) is first tag
  assert.strictEqual(parsed.tags[0].code, 9, 'First tag is SetBackgroundColor (9)');
  console.log('✓ SWF disassembler parsed headers and tags successfully');

  // 3. Test FLA / XFL Project Export & Import
  const project = new FlaProject({
    name: 'SampleMovie',
    width: 800,
    height: 600,
    frameRate: 24,
    backgroundColor: '#1E293B',
    layers: [
      {
        name: 'Characters',
        locked: false,
        visible: true,
        frames: [
          {
            index: 0,
            duration: 1,
            isKeyframe: true,
            actions: 'stop();',
            elements: [
              { type: 'rect', x: 200, y: 150, width: 80, height: 80, fill: '#10B981' }
            ]
          }
        ]
      }
    ]
  });

  const flaBuf = await project.exportBuffer();
  assert(Buffer.isBuffer(flaBuf) && flaBuf.length > 500, 'FLA buffer is valid ZIP');
  assert.strictEqual(flaBuf.slice(0, 4).toString('hex'), '504b0304', 'FLA has valid ZIP signature');

  const parsedFla = await FlaProject.fromBuffer(flaBuf);
  assert.strictEqual(parsedFla.width, 800, 'Parsed FLA width matches');
  assert.strictEqual(parsedFla.height, 600, 'Parsed FLA height matches');
  assert.strictEqual(parsedFla.layers.length, 1, 'Parsed FLA has 1 layer');
  assert.strictEqual(parsedFla.layers[0].name, 'Characters', 'Parsed FLA layer name matches');
  console.log('✓ FLA / XFL project export & import validated');

  // Save sample files
  fs.mkdirSync(path.join(__dirname, 'samples'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'samples', 'sample.swf'), swfBuf);
  fs.writeFileSync(path.join(__dirname, 'samples', 'sample.fla'), flaBuf);
  console.log('✓ Sample SWF and FLA generated in samples/');

  console.log('\nALL MelFlash Studio TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
