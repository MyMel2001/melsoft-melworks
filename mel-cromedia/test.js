// MelCromedia Automated Check Test Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SwfMovie = require('./src/swf');
const FlaProject = require('./src/fla');
const As3Engine = require('./src/as3');
const MelTween = require('./src/tween');

async function runTests() {
  console.log('=== MelCromedia Complete Test Suite ===\n');

  // =========================================
  // 1. SWF Binary Generation & AS3 Tags
  // =========================================
  console.log('1. Testing SWF Binary Generation with AS3...');
  const movie = new SwfMovie({
    version: 19,
    as3: true,
    documentClass: 'Main',
    width: 800,
    height: 600,
    fps: 24,
    backgroundColor: { r: 15, g: 23, b: 42 },
    frames: [
      {
        elements: [
          { x: 100, y: 100, w: 120, h: 80, color: { r: 249, g: 115, b: 22 } }
        ],
        actions: 'stop();\ntrace("Frame 1 initialized");'
      },
      {
        elements: [
          { x: 150, y: 120, w: 120, h: 80, color: { r: 59, g: 130, b: 246 } }
        ],
        actions: 'play();'
      }
    ]
  });

  const swfBuf = movie.toBuffer();
  assert(Buffer.isBuffer(swfBuf), 'SWF export is valid Buffer');
  assert.strictEqual(swfBuf.slice(0, 3).toString('ascii'), 'FWS', 'SWF signature matches FWS');
  assert.strictEqual(swfBuf.readUInt8(3), 19, 'SWF version is 19');

  // Parse SWF and verify AS3 tags
  const parsed = SwfMovie.parse(swfBuf);
  assert.strictEqual(parsed.version, 19, 'Parsed SWF version matches');
  assert.strictEqual(parsed.isActionScript3, true, 'AS3 flag is set');
  assert.strictEqual(parsed.symbolClasses[0].className, 'Main', 'SymbolClass binds Main to timeline');
  assert(parsed.abcBlocks.length >= 1, 'At least one DoABC tag present');
  console.log('   ✓ SWF v19 with AS3 / AVM2 bytecode generation works');

  // =========================================
  // 2. ABC Bytecode Disassembly
  // =========================================
  console.log('\n2. Testing ABC Bytecode Disassembly...');
  const abcBlock = parsed.abcBlocks[0];
  assert(abcBlock.disassembly, 'ABC disassembly object exists');
  assert(abcBlock.disassembly.fullText.includes('callpropvoid'), 'Disassembly contains AVM2 callpropvoid');
  assert(abcBlock.disassembly.fullText.includes('stop'), 'Disassembly references stop method');
  assert(abcBlock.disassembly.fullText.includes('trace'), 'Disassembly references trace function');
  console.log('   ✓ AVM2 ABC bytecode disassembly works');

  // =========================================
  // 3. AS3 Compiler
  // =========================================
  console.log('\n3. Testing AS3 Compiler...');
  const as3Code = `
    var score:int = 100;
    score += 50;
    if (score > 120) {
      trace("High score!");
    }
    stop();
  `;
  const compiledAbc = As3Engine.As3Compiler.compile(as3Code, { className: 'Game' });
  assert(Buffer.isBuffer(compiledAbc), 'Compiled ABC is a Buffer');
  assert(compiledAbc.length > 100, 'Compiled ABC has substantial size');

  const disasm = As3Engine.As3Disassembler.disassemble(compiledAbc);
  assert(disasm.methods.length >= 3, 'Disassembly contains methods');
  assert(disasm.fullText.includes('pushbyte') || disasm.fullText.includes('pushshort'), 'Bytecode contains number push');
  assert(disasm.fullText.includes('add'), 'Bytecode contains addition operation');
  console.log('   ✓ AS3 to AVM2 ABC compilation works');

  // =========================================
  // 4. AS3 Runtime Execution
  // =========================================
  console.log('\n4. Testing AS3 Runtime Execution...');
  const runtime = new As3Engine.As3Runtime({ width: 800, height: 600, fps: 24, totalFrames: 60 });
  runtime.execute(`
    var x:int = 10;
    var y:int = 20;
    trace("Sum: " + (x + y));
    stop();
  `);

  assert.strictEqual(runtime.traces.length, 1, 'Trace output captured');
  assert.strictEqual(runtime.traces[0], 'Sum: 30', 'Arithmetic executed correctly');
  assert.strictEqual(runtime.root.isPlaying, false, 'stop() halted playback');
  console.log('   ✓ AS3 runtime sandbox execution works');

  // =========================================
  // 5. AS3 Class Compilation
  // =========================================
  console.log('\n5. Testing AS3 Class Declaration...');
  const classRuntime = new As3Engine.As3Runtime();
  classRuntime.execute(`
    package {
      public class Player extends MovieClip {
        public function Player() {
          stop();
          trace("Player constructed");
        }
      }
    }
  `);
  assert.strictEqual(classRuntime.traces[0], 'Player constructed', 'Class constructor executed');
  console.log('   ✓ AS3 class declaration and instantiation works');

  // =========================================
  // 6. AS3 Display List API
  // =========================================
  console.log('\n6. Testing AS3 Display List API...');
  const displayRuntime = new As3Engine.As3Runtime();
  displayRuntime.execute(`
    var sp:Sprite = new Sprite();
    sp.graphics.beginFill(0xFF6600);
    sp.graphics.drawRect(0, 0, 100, 80);
    sp.graphics.endFill();
    sp.x = 150;
    sp.y = 200;
    addChild(sp);
    
    var mc:MovieClip = new MovieClip(24);
    mc.x = 50;
    addChild(mc);
    
    trace("Children: " + numChildren);
  `);

  assert.strictEqual(displayRuntime.root.numChildren, 2, 'Display list has 2 children');
  assert.strictEqual(displayRuntime.root.getChildAt(0).x, 150, 'Sprite x coordinate set');
  assert.strictEqual(displayRuntime.root.getChildAt(1).x, 50, 'MovieClip x coordinate set');
  assert.strictEqual(displayRuntime.traces[0], 'Children: 2', 'numChildren reported correctly');
  console.log('   ✓ AS3 DisplayObjectContainer / Sprite / MovieClip API works');

  // =========================================
  // 7. AS3 Event System
  // =========================================
  console.log('\n7. Testing AS3 Event System...');
  const eventRuntime = new As3Engine.As3Runtime();
  eventRuntime.execute(`
    var clickCount:int = 0;
    addEventListener(MouseEvent.CLICK, function(e) {
      clickCount++;
      trace("Click " + clickCount + " at " + e.stageX + "," + e.stageY);
    });
  `);

  const clickEvt = new As3Engine.MouseEvent(As3Engine.MouseEvent.CLICK, true, false, 100, 200);
  eventRuntime.root.dispatchEvent(clickEvt);
  eventRuntime.root.dispatchEvent(clickEvt);

  assert.strictEqual(eventRuntime.traces.length, 2, 'Event listener triggered twice');
  assert.strictEqual(eventRuntime.traces[0], 'Click 1 at 100,200', 'First click event processed');
  assert.strictEqual(eventRuntime.traces[1], 'Click 2 at 100,200', 'Second click event processed');
  console.log('   ✓ AS3 EventDispatcher / MouseEvent works');

  // =========================================
  // 8. AS3 Standard Library (Point, Rectangle, ByteArray, Timer)
  // =========================================
  console.log('\n8. Testing AS3 Standard Library...');
  const stdRuntime = new As3Engine.As3Runtime();
  stdRuntime.execute(`
    var pt:Point = new Point(3, 4);
    trace("Point length: " + pt.length);
    
    var rect:Rectangle = new Rectangle(10, 20, 100, 50);
    trace("Rect contains 50,40: " + rect.contains(50, 40));
    
    var ba:ByteArray = new ByteArray();
    ba.writeInt(12345);
    ba.writeUTF("MelWorks");
    ba.position = 0;
    trace("BA int: " + ba.readInt());
    trace("BA utf: " + ba.readUTF());
  `);

  assert.strictEqual(stdRuntime.traces[0], 'Point length: 5', 'Point.length calculated');
  assert.strictEqual(stdRuntime.traces[1], 'Rect contains 50,40: true', 'Rectangle.contains works');
  assert.strictEqual(stdRuntime.traces[2], 'BA int: 12345', 'ByteArray.readInt works');
  assert.strictEqual(stdRuntime.traces[3], 'BA utf: MelWorks', 'ByteArray.readUTF works');
  console.log('   ✓ AS3 Point / Rectangle / ByteArray classes work');

  // =========================================
  // 9. AS3 Syntax Checker
  // =========================================
  console.log('\n9. Testing AS3 Syntax Checker...');
  const validSyntax = runtime.checkSyntax('var x:int = 10; trace(x);');
  assert.strictEqual(validSyntax.valid, true, 'Valid syntax passes');

  const invalidSyntax = runtime.checkSyntax('var x:int = ;');
  assert.strictEqual(invalidSyntax.valid, false, 'Invalid syntax fails');
  assert(invalidSyntax.message.includes('expected'), 'Error message is descriptive');
  console.log('   ✓ AS3 syntax checker works');

  // =========================================
  // 10. FLA Project Import/Export
  // =========================================
  console.log('\n10. Testing FLA Project Import/Export...');
  const fla = new FlaProject({
    name: 'TestProject',
    width: 640,
    height: 480,
    frameRate: 30,
    backgroundColor: '#1E293B',
    actionScriptVersion: '3',
    documentClass: 'Main',
    layers: [
      {
        name: 'Actions',
        locked: false,
        visible: true,
        frames: [
          {
            index: 0,
            duration: 1,
            isKeyframe: true,
            actions: 'stop();\ntrace("FLA loaded");',
            elements: [
              { type: 'rect', x: 50, y: 50, width: 100, height: 80, fill: '#FF6600', stroke: '#000000', strokeWidth: 2 }
            ]
          }
        ]
      }
    ],
    symbols: [
      { name: 'Logo', type: 'movie clip', elements: [] }
    ]
  });

  const xflXml = fla.toXflXml();
  assert(xflXml.includes('width="640"'), 'XFL width attribute');
  assert(xflXml.includes('actionScriptVersion="3"'), 'XFL AS3 version attribute');
  assert(xflXml.includes('<Actionscript>'), 'XFL includes Actionscript tag');
  assert(xflXml.includes('stop();'), 'XFL includes frame script');

  const zipBuf = await fla.exportBuffer();
  assert(Buffer.isBuffer(zipBuf), 'FLA export produces Buffer');
  assert(zipBuf.length > 500, 'FLA buffer has substantial size');

  const restored = await FlaProject.fromBuffer(zipBuf);
  assert.strictEqual(restored.width, 640, 'Restored FLA width');
  assert.strictEqual(restored.height, 480, 'Restored FLA height');
  assert.strictEqual(restored.frameRate, 30, 'Restored FLA frame rate');
  assert.strictEqual(restored.actionScriptVersion, '3', 'Restored AS3 version');
  assert.strictEqual(restored.layers[0].frames[0].actions.includes('stop();'), true, 'Restored frame actions');
  console.log('   ✓ FLA / XFL import and export works');

  // =========================================
  // 11. End-to-End SWF Export from FLA
  // =========================================
  console.log('\n11. Testing End-to-End SWF Export from FLA...');
  const swfFromFla = new SwfMovie({
    version: 19,
    as3: true,
    documentClass: restored.documentClass,
    width: restored.width,
    height: restored.height,
    fps: restored.frameRate,
    backgroundColor: { r: 30, g: 41, b: 59 },
    frames: restored.layers[0].frames.map(f => ({
      elements: f.elements,
      actions: f.actions
    }))
  });

  const finalSwf = swfFromFla.toBuffer();
  const finalParsed = SwfMovie.parse(finalSwf);
  assert.strictEqual(finalParsed.isActionScript3, true, 'Final SWF is AS3');
  assert(finalParsed.abcBlocks[0].disassembly.fullText.includes('FLA loaded'), 'Final SWF contains FLA trace');
  console.log('   ✓ End-to-end FLA → SWF export with AS3 works');

  // =========================================
  // 12. MELCROMADIA TWEEN ENGINE
  // =========================================
  console.log('\n12. Testing MelTween Engine...');
  const TWEEN_EASING_NAMES = ['linear', 'quadIn', 'quadOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut', 'backOut', 'elasticOut', 'bounceOut'];
  for (const name of TWEEN_EASING_NAMES) {
    assert.ok(Math.abs(MelTween.ease(name, 0)) < 1e-9, `ease(${name}, 0) clamps to 0`);
    assert.ok(Math.abs(MelTween.ease(name, 1) - 1) < 1e-9, `ease(${name}, 1) clamps to 1`);
    assert.strictEqual(typeof MelTween.EASING[name], 'function', `EASING defines ${name}`);
  }
  for (const name of ['elasticOut', 'bounceOut']) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const v = MelTween.ease(name, t);
      assert.ok(v >= 0 && v <= 1, `ease(${name}, ${t}) in range`);
    }
  }
  assert.strictEqual(MelTween.ease('unknownEase', 0.5), 0.5, 'Unknown easing falls back to linear');

  assert.strictEqual(MelTween.tweenValue(0, 100, 0.5, 'linear'), 50, 'tweenValue interpolates linearly');
  assert.strictEqual(MelTween.tweenValue(0, 100, 0.5, 'quadOut'), 75, 'tweenValue honors easing');

  const blendedHex = MelTween.lerpColor('#ff0000', '#00ff00', 0.5);
  assert(/^#[0-9a-f]{6}$/i.test(blendedHex), 'lerpColor returns valid hex');
  assert.strictEqual(MelTween.lerpColor('#112233', '#112233', 0.5), '#112233', 'lerpColor round trip preserves color');

  const fullFrom = { type: 'rect', x: 10, y: 20, width: 100, height: 50, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1, fill: '#ff0000', stroke: '#000000', strokeWidth: 2 };
  const fullTo = { type: 'rect', x: 30, y: 40, width: 150, height: 90, rotation: 30, scaleX: 2, scaleY: 0.5, alpha: 0.5, fill: '#00ff00', stroke: '#000000', strokeWidth: 3 };
  const fullMid = MelTween.interpolateProps(fullFrom, fullTo, 0.5, 'linear');
  assert.strictEqual(fullMid.x, 20, 'interpolateProps midpoint x');
  assert.strictEqual(fullMid.width, 125, 'interpolateProps midpoint width');
  assert.strictEqual(fullMid.alpha, 0.75, 'interpolateProps midpoint alpha');
  assert.strictEqual(fullMid.scaleX, 1.5, 'interpolateProps midpoint scaleX');
  assert.strictEqual(fullMid.scaleY, 0.75, 'interpolateProps midpoint scaleY');
  assert.strictEqual(fullMid.rotation, 15, 'interpolateProps midpoint rotation');
  assert.strictEqual(fullMid.strokeWidth, 2.5, 'interpolateProps midpoint strokeWidth');
  assert.ok(/^#[0-9a-f]{6}$/i.test(fullMid.fill), 'interpolateProps midpoint fill is hex');

  const morphFrom = { type: 'path', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
  const morphTo = { type: 'path', points: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }] };
  const sameCountMorphed = MelTween.interpolatePath(morphFrom.points, morphTo.points, 1, 'linear');
  assert.strictEqual(sameCountMorphed.length, 3, 'interpolatePath returns original count for equal lengths');
  assert.strictEqual(sameCountMorphed[0].x, 20, 'interpolatePath endpoint preserved (start)');

  const diffCountMorphed = MelTween.interpolatePath(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }],
    1,
    'linear'
  );
  assert.strictEqual(diffCountMorphed.length, 4, 'interpolatePath resamples to max point count');

  const groupFrom = { type: 'group', elements: [{ type: 'rect', x: 0, y: 0, width: 10, height: 10, alpha: 1, rotation: 0 }] };
  const groupTo = { type: 'group', elements: [{ type: 'rect', x: 5, y: 5, width: 20, height: 20, alpha: 1, rotation: 0 }] };
  const groupMid = MelTween.interpolateElements([groupFrom], [groupTo], 0.5, 'linear');
  assert.strictEqual(groupMid[0].type, 'group', 'interpolateElements keeps group type');
  assert.strictEqual(groupMid[0].elements.length, 1, 'interpolateElements recurses group children');
  assert.strictEqual(groupMid[0].elements[0].x, 2.5, 'interpolateElements interpolates child props');

  const symFrom = { type: 'symbol', symbolName: 'Logo', elements: [] };
  const symTo = { type: 'symbol', symbolName: 'Logo', elements: [] };
  const symMid = MelTween.interpolateElements([symFrom], [symTo], 0.5, 'linear');
  assert.strictEqual(symMid[0].type, 'symbol', 'interpolateElements handles symbol instances');

  const fromKF = { kf: { elements: [{ type: 'rect', x: 0, y: 0, width: 10, height: 10, alpha: 1, rotation: 0, fill: '#f97316' }] }, frame: 0 };
  const toKF = { kf: { elements: [{ type: 'rect', x: 100, y: 0, width: 10, height: 10, alpha: 1, rotation: 0, fill: '#f97316' }] }, frame: 100 };
  const sameFrameEls = MelTween.tweenFrame({ fromKF, toKF: fromKF, frame: 50, easeName: 'linear' });
  assert.strictEqual(sameFrameEls.length, 1, 'tweenFrame same-frame returns from copy');
  assert.strictEqual(sameFrameEls[0].x, 0, 'tweenFrame same-frame returns from values');

  const missingNextEls = MelTween.tweenFrame({ fromKF, toKF: null, frame: 50, easeName: 'linear' });
  assert.strictEqual(missingNextEls.length, 1, 'tweenFrame missing-next returns from');

  const midEls = MelTween.tweenFrame({ fromKF, toKF, frame: 50, easeName: 'linear' });
  assert.strictEqual(midEls[0].x, 50, 'tweenFrame mid-frame tween');
  const firstEls = MelTween.tweenFrame({ fromKF, toKF, frame: 0, easeName: 'linear' });
  assert.strictEqual(firstEls[0].x, 0, 'tweenFrame start frame returns from');
  const lastEls = MelTween.tweenFrame({ fromKF, toKF, frame: 100, easeName: 'linear' });
  assert.strictEqual(lastEls[0].x, 100, 'tweenFrame end frame returns to');

  // Every documented tween export must be present
  for (const key of ['EASING', 'ease', 'lerp', 'lerpColor', 'tweenValue', 'interpolateProps', 'interpolatePath', 'interpolateElements', 'tweenFrame']) {
    assert.strictEqual(typeof MelTween[key], (key === 'EASING') ? 'object' : 'function', `MelTween exposes ${key}`);
  }

  // =========================================
  // Final Summary
  // =========================================
  console.log('\n========================================');
  console.log('ALL 12 TESTS PASSED');
  console.log('========================================');
  console.log('MelCromedia Professional Studio is fully functional with:');
  console.log('  • SWF v19 binary encoder/decoder');
  console.log('  • AS3 → AVM2 ABC bytecode compiler');
  console.log('  • AVM2 ABC disassembler');
  console.log('  • AS3 runtime execution sandbox');
  console.log('  • Flash Player standard library (DisplayList, Events, Geometry, ByteArray, Timer)');
  console.log('  • FLA / XFL project serialization');
  console.log('  • End-to-end AS3 workflow');
  console.log('  • MelTween engine (easings, interpolation, shape morphing)');
}

runTests().catch(err => {
  console.error('TEST FAILURE:', err.message);
  console.error(err.stack);
  process.exit(1);
});
