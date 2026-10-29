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
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', leftPath
  ]);
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', 'color=c=blue:size=320x240:rate=10:duration=1',
    '-f', 'lavfi', '-i', 'sine=frequency=550:duration=1',
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

  // 9. Test MelFilm keyframe tween engine (sampling, easing, expressions)
  const { addKeyframe, removeKeyframe, getKeyframe, sampleKeyframes, toFfmpegExpr, buildTweenExpressions } = require('./src/tween');

  const twLayer = { keyframes: [] };
  addKeyframe(twLayer, 0, { x: 0, scale: 1, opacity: 1 }, 'linear');
  addKeyframe(twLayer, 10, { x: 100, scale: 0.5, opacity: 0.2 }, 'linear');
  const mid = sampleKeyframes(twLayer.keyframes, 5);
  assert.strictEqual(mid.x, 50, 'MelFilm tween linear midpoint is the average');
  assert.strictEqual(mid.scale, 0.75, 'MelFilm tween linear midpoint scale interpolated');
  assert.strictEqual(sampleKeyframes(twLayer.keyframes, 0).x, 0, 'MelFilm tween start endpoint exact');
  assert.strictEqual(sampleKeyframes(twLayer.keyframes, 10).scale, 0.5, 'MelFilm tween end endpoint exact');
  assert.strictEqual(sampleKeyframes(twLayer.keyframes, 999).x, 100, 'MelFilm tween clamps past last keyframe');
  assert.deepStrictEqual(sampleKeyframes([], 3), { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, 'MelFilm tween empty keyframes fall back to defaults');

  const ioLayer = { keyframes: [
    { frame: 0, easing: 'easeInOut', props: { x: 0 } },
    { frame: 10, easing: 'linear', props: { x: 100 } }
  ] };
  const ioMid = sampleKeyframes(ioLayer.keyframes, 5);
  assert.strictEqual(ioMid.x, 50, 'MelFilm tween easeInOut midpoint is symmetric (average)');
  assert.strictEqual(sampleKeyframes(ioLayer.keyframes, 0).x, 0, 'MelFilm tween easeInOut start exact');
  assert.strictEqual(sampleKeyframes(ioLayer.keyframes, 10).x, 100, 'MelFilm tween easeInOut end exact');
  const inLayer = { keyframes: [{ frame: 0, easing: 'easeIn', props: { x: 0 } }, { frame: 10, props: { x: 100 } }] };
  assert.ok(sampleKeyframes(inLayer.keyframes, 5).x < 50, 'MelFilm tween easeIn midpoint below average');
  const outLayer = { keyframes: [{ frame: 0, easing: 'easeOut', props: { x: 0 } }, { frame: 10, props: { x: 100 } }] };
  assert.ok(sampleKeyframes(outLayer.keyframes, 5).x > 50, 'MelFilm tween easeOut midpoint above average');
  const bounceLayer = { keyframes: [{ frame: 0, easing: 'bounceOut', props: { x: 0 } }, { frame: 10, props: { x: 100 } }] };
  assert.ok(sampleKeyframes(bounceLayer.keyframes, 5).x > 0 && sampleKeyframes(bounceLayer.keyframes, 5).x < 100, 'MelFilm tween bounceOut midpoint bounded');

  const kmLayer = { keyframes: [] };
  const added = addKeyframe(kmLayer, 4, { scale: 2 }, 'easeIn');
  assert.strictEqual(added.easing, 'easeIn', 'MelFilm addKeyframe stores easing');
  assert.strictEqual(getKeyframe(kmLayer, 4).props.opacity, 1, 'MelFilm addKeyframe applies prop defaults');
  addKeyframe(kmLayer, 4, { scale: 3 }, 'linear');
  assert.strictEqual(kmLayer.keyframes.length, 1, 'MelFilm addKeyframe replaces same-frame keyframe');
  assert.strictEqual(getKeyframe(kmLayer, 4).props.scale, 3, 'MelFilm addKeyframe overwrites same-frame props');
  addKeyframe(kmLayer, 9, { opacity: 0.5 });
  assert.strictEqual(kmLayer.keyframes.length, 2, 'MelFilm addKeyframe appends and sorts');
  assert.strictEqual(removeKeyframe(kmLayer, 4), 1, 'MelFilm removeKeyframe removes one keyframe');
  assert.strictEqual(removeKeyframe(kmLayer, 4), 0, 'MelFilm removeKeyframe reports missing keyframe');
  assert.strictEqual(getKeyframe(kmLayer, 4), null, 'MelFilm getKeyframe returns null after removal');
  console.log('✓ MelFilm keyframe sampling/easing/add-remove validated');

  // 10. Test MelFilm comp keyframe JSON roundtrip + FFMPEG tween expressions
  const twComp = MelFilmComp.create('TweenComp');
  twComp.frameRate = 24;
  const twCompLayer = twComp.addLayer('Animated', 'clip.mp4');
  twComp.addKeyframe(twCompLayer.id, 0, { scale: 1, opacity: 1 }, 'linear');
  twComp.addKeyframe(twCompLayer.id, 24, { scale: 0.5, opacity: 0.2 }, 'easeInOut');
  assert.strictEqual(twComp.frameDuration(), 1 / 24, 'MelFilm comp frameDuration = 1 / frameRate');
  assert.strictEqual(twComp.durationSeconds(), 0, 'MelFilm comp durationSeconds uses frameCount');
  twComp.frameCount = 48;
  assert.strictEqual(twComp.durationSeconds(), 2, 'MelFilm comp durationSeconds = frameCount / frameRate');
  const twJson = twComp.toJSON();
  assert.strictEqual(twJson.layers[0].keyframes.length, 2, 'MelFilm comp toJSON serializes keyframes');
  const twBack = MelFilmComp.fromJSON(twJson);
  assert.strictEqual(twBack.layers[0].keyframes.length, 2, 'MelFilm comp JSON roundtrip preserves keyframes');
  assert.strictEqual(twBack.sampleLayer(twBack.layers[0].id, 12).scale, 0.75, 'MelFilm comp sampleLayer interpolates roundtripped keyframes');
  const legacy = MelFilmComp.fromJSON({ name: 'Old', layers: [{ id: 'layer-1', name: 'L', source: 'a.mp4' }] });
  assert.deepStrictEqual(legacy.layers[0].keyframes, [], 'MelFilm comp fromJSON gives old layers empty keyframes');

  const exprs = buildTweenExpressions({ keyframes: [
    { frame: 0, easing: 'linear', props: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 } },
    { frame: 24, easing: 'linear', props: { scale: 0.5, opacity: 1, x: 0, y: 0, rotation: 0 } }
  ] }, 24);
  assert.ok(typeof exprs.scale === 'string' && exprs.scale.includes('if(between(t'), 'MelFilm buildTweenExpressions animates scale with if(between(t');
  assert.strictEqual(exprs.opacity, null, 'MelFilm buildTweenExpressions leaves static opacity null');
  assert.strictEqual(exprs.x, null, 'MelFilm buildTweenExpressions leaves static x null');
  assert.strictEqual(exprs.rotation, null, 'MelFilm buildTweenExpressions leaves static rotation null');
  const piece = toFfmpegExpr([[0.5, [0, 24]], [1]], 24);
  assert.ok(piece.includes('if(between(t,0,1)'), 'MelFilm toFfmpegExpr builds between(t,...) from frames');
  console.log('✓ MelFilm comp keyframes + FFMPEG tween expressions validated');

  // 12. Test MelFilm timeline model (NLE clip editing timeline)
  const { MelFilmTimeline } = require('./src/timeline');
  const timeline = MelFilmTimeline.create('Main', 10);
  const vTrack = timeline.addTrack('Video', 'video');
  const tlClip1 = timeline.addClip(vTrack.id, srcPath, 0, 10);
  const tlClip2 = timeline.addClip(vTrack.id, rightPath, 0, 10);
  assert.strictEqual(timeline.getClips(vTrack.id).length, 2, 'MelFilm timeline adds clips');
  assert.strictEqual(timeline.setClipRange(vTrack.id, tlClip2.id, 0, 5), true, 'MelFilm timeline trims clip range');
  assert.strictEqual(timeline.computeDuration(), 1, 'MelFilm timeline duration seconds');
  const tlBack = MelFilmTimeline.fromJSON(timeline.toJSON());
  assert.strictEqual(tlBack.getClips(vTrack.id).length, 2, 'MelFilm timeline JSON roundtrips clips');
  let tlErr = false;
  try { await MelFfmpeg.renderTimeline({ timeline: MelFilmTimeline.create('Empty'), outputPath: outPath, format: 'mp4' }); } catch (e) { tlErr = true; }
  assert.ok(tlErr, 'MelFilm renderTimeline rejects empty timeline');

  const tlOutPath = path.join(os.tmpdir(), 'mel-film-timeline-out.mp4');
  const tlRes = await MelFfmpeg.renderTimeline({ timeline, outputPath: tlOutPath, resolution: '320x240', fps: 10, format: 'mp4', transition: 'fade', transitionDuration: 0.5 });
  assert(fs.existsSync(tlOutPath) && fs.statSync(tlOutPath).size > 0, 'FFMPEG timeline render produced output');

  const gradeOutPath = path.join(os.tmpdir(), 'mel-film-grade-out.mp4');
  const gradeRes = await MelFfmpeg.applyGrade({ inputPath: srcPath, outputPath: gradeOutPath, grade: { brightness: 0.05, contrast: 1.2, saturation: 0.8, hue: 10 } });
  assert(fs.existsSync(gradeOutPath) && fs.statSync(gradeOutPath).size > 0, 'FFMPEG color grade produced output');
  console.log('✓ MelFilm timeline render + color grade validated');

  // 13. Test MelFilm Adobe project XML builders
  const aepxXmlBuilt = MelFilmBundle.buildAepxXml('MyFilm', [{ name: 'Comp1', width: 1920, height: 1080, frameRate: 24, layers: [{ id: 'layer-1', name: 'Background', source: 'bg.mp4' }] }]);
  assert.ok(aepxXmlBuilt.includes('Comp1'), 'MelFilm AEPX XML builder emits composition');
  assert.ok(aepxXmlBuilt.includes('bg.mp4'), 'MelFilm AEPX XML builder emits layer source');
  const prprojXmlBuilt = MelFilmBundle.buildPrprojXml('MyFilm', [{ name: 'Comp1', width: 1920, height: 1080, frameRate: 24, frameCount: 48, layers: [{ id: 'layer-1', name: 'Background', source: 'bg.mp4' }] }]);
  assert.ok(prprojXmlBuilt.includes('Comp1'), 'MelFilm PRPROJ XML builder emits sequence');
  console.log('✓ MelFilm Adobe project XML builders validated');

  // 11. Test MelFilm FFMPEG tween render (real renderTween on 2s lavfi clip)
  const tweenOutPath = path.join(os.tmpdir(), 'mel-film-tween-out.mp4');
  let tweenErr = null;
  try {
    await MelFfmpeg.renderTween({ inputPath: srcPath, outputPath: tweenOutPath, keyframes: [], frameRate: 10 });
  } catch (e) { tweenErr = e; }
  assert.ok(tweenErr && /non-empty keyframes/.test(tweenErr.message), 'MelFilm renderTween rejects empty keyframes');
  await MelFfmpeg.renderTween({
    inputPath: srcPath,
    outputPath: tweenOutPath,
    keyframes: [
      { frame: 0, easing: 'linear', props: { scale: 1, opacity: 1 } },
      { frame: 19, easing: 'linear', props: { scale: 0.5, opacity: 0.2 } }
    ],
    frameRate: 10
  });
  assert(fs.existsSync(tweenOutPath) && fs.statSync(tweenOutPath).size > 0, 'FFMPEG tween render produced output');
  console.log('✓ MelFilm FFMPEG tween render validated');

  console.log('\nALL MELFILM TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
