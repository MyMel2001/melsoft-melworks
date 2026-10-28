// MelFilm Automated Check Test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { MelFfmpeg, runFfmpeg } = require('./src/ffmpeg');
const { MelFilmBundle } = require('./src/bundle');

async function runTests() {
  console.log('Testing MelFilm FFMPEG engine...');

  const srcPath = path.join(os.tmpdir(), 'mel-film-src.mp4');
  const posterPath = path.join(os.tmpdir(), 'mel-film-poster.png');
  const outPath = path.join(os.tmpdir(), 'mel-film-out.mp4');

  // Generate a short test source video with FFMPEG lavfi sources
  const gen = await runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=10',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    srcPath
  ]);
  assert(fs.existsSync(srcPath) && fs.statSync(srcPath).size > 0, 'FFMPEG test source generated');
  console.log('✓ FFMPEG lavfi test source generated');

  const info = await MelFfmpeg.probe(srcPath);
  assert.strictEqual(info.width, 320, 'FFMPEG probe width matches source');
  console.log('✓ MelFilm FFMPEG probe validated');

  const posterRes = await MelFfmpeg.capturePoster({ inputPath: srcPath, outputPath: posterPath, timeSeconds: 1 });
  assert(fs.existsSync(posterPath) && fs.statSync(posterPath).size > 0, 'FFMPEG poster capture produced output');
  console.log('✓ MelFilm FFMPEG poster capture validated');

  const renderRes = await MelFfmpeg.exportVideo({ inputPath: srcPath, outputPath: outPath, resolution: '128x72', format: 'mp4', fps: 30 });
  assert(fs.existsSync(outPath) && fs.statSync(outPath).size > 0, 'FFMPEG export produced output');
  console.log('✓ MelFilm FFMPEG export validated');

  // 5. Test MelFilm project bundle save/load (ZIP of .aepx / .prproj)
  const { MelFilmBundle } = require('./src/bundle');
  const aepxXml = '<?xml version="1.0"?><Project><Composition name="Comp1"/></Project>';
  const aepxBuf = await MelFilmBundle.saveAepx('MyFilm', aepxXml);
  const aepxZip = await MelFilmBundle.loadBundle(aepxBuf);
  assert.strictEqual(aepxZip.files['project.aepx'], aepxXml, 'MelFilm AEPX bundle roundtrips project XML');
  assert.ok(aepxZip.files['manifest.json'].includes('aepx'), 'MelFilm AEPX bundle has manifest');

  const prprojXml = '<?xml version="1.0"?><Project><Sequence name="Seq1"/></Project>';
  const prprojBuf = await MelFilmBundle.savePrproj('MyFilm', prprojXml);
  const prprojZip = await MelFilmBundle.loadBundle(prprojBuf);
  const prprojGzipped = Buffer.from(prprojZip.files['project.prproj'], 'base64');
  const prprojDecompressed = zlib.gunzipSync(prprojGzipped).toString('utf8');
  assert.strictEqual(prprojDecompressed, prprojXml, 'MelFilm PRPROJ bundle gzip roundtrips project XML');
  console.log('✓ MelFilm project bundle engine validated');

  // 6. Test MelFilm After Effects-style composition engine (comps + layers)
  const { MelFilmComp } = require('./src/comp');
  const comp = MelFilmComp.create('Main');
  const layer1 = comp.addLayer('Background', 'bg.mp4');
  const layer2 = comp.addLayer('Foreground', 'fg.mp4');
  assert.strictEqual(comp.layers.length, 2, 'MelFilm comp adds layers');
  assert.strictEqual(comp.getLayer(layer1.id).name, 'Background', 'MelFilm comp reads layer by id');
  assert.strictEqual(comp.removeLayer(layer2.id), 1, 'MelFilm comp removes one layer');
  assert.strictEqual(comp.layers.length, 1, 'MelFilm comp layer removal updates stack');

  const compJson = comp.toJSON();
  assert.strictEqual(compJson.name, 'Main', 'MelFilm comp serializes name');
  assert.strictEqual(compJson.layers.length, 1, 'MelFilm comp serializes layers');
  const compBack = MelFilmComp.fromJSON(compJson);
  assert.strictEqual(compBack.name, 'Main', 'MelFilm comp deserializes name');
  assert.strictEqual(compBack.layers.length, 1, 'MelFilm comp deserializes layers');
  assert.strictEqual(compBack.getLayer(comp.layers[0].id).name, 'Background', 'MelFilm comp JSON roundtrips layers');
  console.log('✓ MelFilm composition engine validated');

  // 7. Test MelFilm FFMPEG crossfade (xfade between two inputs)
  const leftPath = path.join(os.tmpdir(), 'mel-film-left.mp4');
  const rightPath = path.join(os.tmpdir(), 'mel-film-right.mp4');
  const xfadePath = path.join(os.tmpdir(), 'mel-film-xfade.mp4');
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', 'color=c=red:size=320x240:rate=10:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', leftPath
  ]);
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', 'color=c=blue:size=320x240:rate=10:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', rightPath
  ]);
  const xfadeRes = await MelFfmpeg.crossfade({ inputs: [{ inputPath: leftPath }, { inputPath: rightPath }], outputPath: xfadePath, transition: 'fade', duration: 0.5 });
  assert(fs.existsSync(xfadePath) && fs.statSync(xfadePath).size > 0, 'FFMPEG crossfade produced output');
  console.log('✓ MelFilm FFMPEG crossfade validated');

  let crossfadeErr = false;
  try {
    await MelFfmpeg.crossfade({ inputs: [{ inputPath: leftPath }], outputPath: xfadePath, transition: 'fade', duration: 0.5 });
  } catch (e) { crossfadeErr = true; }
  assert.ok(crossfadeErr, 'MelFilm crossfade rejects inputs count != 2');

  let transitionErr = false;
  try {
    await MelFfmpeg.crossfade({ inputs: [{ inputPath: leftPath }, { inputPath: rightPath }], outputPath: xfadePath, transition: 'not-a-transition', duration: 0.5 });
  } catch (e) { transitionErr = true; }
  assert.ok(transitionErr, 'MelFilm crossfade rejects unknown transition');
  console.log('✓ MelFilm crossfade transition validation validated');

  // 8. Test MelFilm project model (composition stack persistence)
  const { MelFilmProject } = require('./src/project');
  const mfProject = MelFilmProject.create('MyFilm');
  const comp1 = MelFilmComp.create('Comp1');
  comp1.width = 1920;
  comp1.height = 1080;
  comp1.addLayer('Background', 'bg.mp4');
  mfProject.addComp(comp1);
  const mfJson = mfProject.toJSON();
  assert.strictEqual(mfJson.name, 'MyFilm', 'MelFilm project serializes name');
  assert.strictEqual(mfJson.comps.length, 1, 'MelFilm project serializes comps');
  const mfBack = MelFilmProject.fromJSON(mfJson);
  assert.strictEqual(mfBack.comps.length, 1, 'MelFilm project JSON roundtrips comps');
  assert.strictEqual(mfBack.getComp('Comp1').layers.length, 1, 'MelFilm project JSON roundtrips comp layers');
  console.log('✓ MelFilm project model validated');

  console.log('\nALL MELFILM TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
