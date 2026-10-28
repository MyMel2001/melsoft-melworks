// MelSound Automated Check Test
const assert = require('assert');
const { MelSoundProject } = require('./src/project');

function runTests() {
  console.log('Testing MelSound project engine...');

  const project = new MelSoundProject({ bpm: 140, masterGain: 0.9 });
  const track = project.addTrack('Bassline');
  assert.strictEqual(project.tracks.length, 1, 'MelSound project adds track');
  assert.strictEqual(track.steps.length, 16, 'MelSound pattern has 16 steps');

  assert.strictEqual(project.setStep(track.id, 0, 60), true, 'MelSound setStep stores note');
  assert.strictEqual(project.getStep(track.id, 0), 60, 'MelSound getStep reads note');
  assert.strictEqual(project.getStep(track.id, 15), 0, 'MelSound default step is rest');

  project.setBpm(160);
  assert.strictEqual(project.bpm, 160, 'MelSound setBpm updates tempo');

  const inst = project.addInstrument('Sythesizer V', 'vst', 'SythesizerV', { cutoff: 2000 });
  assert.strictEqual(project.instruments.length, 1, 'MelSound project adds instrument');
  assert.strictEqual(inst.type, 'vst', 'MelSound instrument type recorded');

  const json = project.serialize();
  const parsed = MelSoundProject.deserialize(json);
  assert.strictEqual(parsed.bpm, 160, 'MelSound serialize/deserialize preserves bpm');
  assert.strictEqual(parsed.tracks.length, 1, 'MelSound serialize/deserialize preserves tracks');
  assert.strictEqual(parsed.instruments.length, 1, 'MelSound serialize/deserialize preserves instruments');

  console.log('\nALL MELSOUND TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
