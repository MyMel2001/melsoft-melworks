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

  console.log('\nALL MELFILM TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
