// MelFilm Automated Check Test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MelFfmpeg, runFfmpeg } = require('./src/ffmpeg');

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

  console.log('\nALL MELFILM TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
