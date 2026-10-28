// MelSound Automated Check Test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MelSoundProject } = require('./src/project');

function runTests() {
  console.log('Testing MelSound project engine...');

  const project = new MelSoundProject({ bpm: 140, masterGain: 0.9 });
  const track = project.addTrack('Bassline');
  assert.strictEqual(project.tracks.length, 1, 'MelSound project adds track');
  assert.strictEqual(track.steps.length, 16, 'MelSound pattern has 16 steps');

  const vocalTrack = project.addTrack('Vocal Lead', 'vocal');
  assert.strictEqual(vocalTrack.kind, 'vocal', 'MelSound addTrack creates vocal composition');
  assert.strictEqual(project.setLyrics(vocalTrack.id, 'Hello world'), true, 'MelSound setLyrics stores lyrics');
  assert.strictEqual(vocalTrack.lyrics, 'Hello world', 'MelSound lyrics editable');

  assert.strictEqual(project.setStep(track.id, 0, 60), true, 'MelSound setStep stores note');
  assert.strictEqual(project.getStep(track.id, 0), 60, 'MelSound getStep reads note');
  assert.strictEqual(project.getStep(track.id, 15), 0, 'MelSound default step is rest');

  project.setBpm(160);
  assert.strictEqual(project.bpm, 160, 'MelSound setBpm updates tempo');

  const created = MelSoundProject.create('vocal', 90);
  assert.strictEqual(created.kind, 'vocal', 'MelSound create sets project kind');
  assert.strictEqual(created.bpm, 90, 'MelSound create sets bpm');

  const kindOut = project.setKind('vocal');
  assert.strictEqual(kindOut, 'vocal', 'MelSound setKind updates kind');
  assert.strictEqual(project.kind, 'vocal', 'MelSound setKind stores kind');

  const inst = project.addInstrument('Sythesizer V', 'vst', 'SythesizerV', { cutoff: 2000 });
  assert.strictEqual(project.instruments.length, 1, 'MelSound project adds instrument');
  assert.strictEqual(inst.type, 'vst', 'MelSound instrument type recorded');

  const json = project.serialize();
  const parsed = MelSoundProject.deserialize(json);
  assert.strictEqual(parsed.bpm, 160, 'MelSound serialize/deserialize preserves bpm');
  assert.strictEqual(parsed.tracks.length, 2, 'MelSound serialize/deserialize preserves tracks');
  assert.strictEqual(parsed.instruments.length, 1, 'MelSound serialize/deserialize preserves instruments');
  assert.strictEqual(parsed.kind, 'vocal', 'MelSound serialize/deserialize preserves kind');
  assert.strictEqual(parsed.patterns.length, 0, 'MelSound serialize/deserialize preserves patterns');

  console.log('✓ MelSound instrument add validated');

  // 2b. Test MelSound pattern management (FL Studio pattern workflow)
  const pattern = project.addPattern('Verse');
  assert.strictEqual(project.patterns.length, 1, 'MelSound addPattern creates pattern');
  assert.strictEqual(pattern.name, 'Verse', 'MelSound pattern name set');
  assert.ok(pattern.steps[track.id], 'MelSound pattern keyed by track id');
  assert.strictEqual(Object.keys(pattern.steps).length, 2, 'MelSound pattern seeds steps for all tracks');

  assert.strictEqual(project.setStepOnPattern(pattern.id, track.id, 0, 62), true, 'MelSound setStepOnPattern stores note');
  assert.strictEqual(project.getStepOnPattern(pattern.id, track.id, 0), 62, 'MelSound getStepOnPattern reads note');
  assert.strictEqual(project.getStepOnPattern(pattern.id, track.id, 15), 0, 'MelSound pattern default step is rest');

  assert.strictEqual(project.removePattern(pattern.id), 1, 'MelSound removePattern deletes pattern');
  assert.strictEqual(project.patterns.length, 0, 'MelSound pattern removal updates stack');

  const keptPattern = project.addPattern('Chorus');
  assert.strictEqual(project.selectPattern(keptPattern.id), keptPattern.id, 'MelSound selectPattern returns pattern id');
  assert.strictEqual(project.getPattern(keptPattern.id).name, 'Chorus', 'MelSound getPattern reads pattern');
  console.log('✓ MelSound pattern workflow validated');

  // 2c. Test MelSound pattern chain (song arrangement sequencing)
  const chainPattern = project.addPattern('Drop');
  assert.strictEqual(project.addPatternToChain(chainPattern.id), true, 'MelSound addPatternToChain appends pattern');
  assert.strictEqual(project.addPatternToChain(chainPattern.id), false, 'MelSound addPatternToChain rejects duplicate');
  assert.deepStrictEqual(project.getPatternChain(), [chainPattern.id], 'MelSound pattern chain reads ordered ids');
  assert.strictEqual(project.removePatternFromChain(chainPattern.id), 1, 'MelSound removePatternFromChain removes entry');
  assert.deepStrictEqual(project.getPatternChain(), [], 'MelSound pattern chain updates after removal');
  console.log('✓ MelSound pattern chain validated');

  // 3. Test MelSound FLP binary writer/reader roundtrip
  const { MelFlsWriter, MelFlsReader } = require('./src/flp');
  const writer = new MelFlsWriter();
  writer.addTempo(140);
  writer.addKind('vocal');
  writer.addName('Test Vocal Project');
  const flpBuf = writer.build();
  const parsedFlp = MelFlsReader.parse(flpBuf);
  assert.strictEqual(parsedFlp.bpm, 140, 'MelSound FLP roundtrip preserves bpm');
  assert.strictEqual(parsedFlp.kind, 'vocal', 'MelSound FLP roundtrip preserves kind');
  assert.strictEqual(parsedFlp.name, 'Test Vocal Project', 'MelSound FLP roundtrip preserves name');

  const badFlp = new Uint8Array([0x00, 0x01, 0x02]);
  let flpErr = false;
  try { MelFlsReader.parse(badFlp); } catch (e) { flpErr = true; }
  assert.ok(flpErr, 'MelSound FLP reader rejects bad magic');

  console.log('✓ MelSound FLP binary roundtrip validated');

  // 4. Test MelSound audio sequence builder and note frequency math
  const { buildSequence, noteToFrequency } = require('./src/audio');
  assert.strictEqual(noteToFrequency(69), 440, 'MelSound noteToFrequency: A4 = 440Hz');
  const seqProject = new MelSoundProject({ bpm: 140 });
  const seqTrack = seqProject.addTrack('Lead');
  seqProject.setStep(seqTrack.id, 4, 60);
  const seq = buildSequence(seqProject);
  assert.strictEqual(seq.events.length, 1, 'MelSound sequence builds one note event');
  assert.strictEqual(seq.events[0].midi, 60, 'MelSound sequence note midi preserved');
  assert.ok(Math.abs(seq.events[0].time - (4 * 60) / (140 * 4)) < 1e-9, 'MelSound sequence event time correct');
  assert.ok(seq.duration > 0, 'MelSound sequence duration positive');

  const mixProject = new MelSoundProject({ bpm: 140 });
  const mixTrack = mixProject.addTrack('Bassline');
  mixProject.setStep(mixTrack.id, 0, 60);
  const mixSeq = buildSequence(mixProject);
  assert.strictEqual(mixSeq.events.length, 1, 'MelSound sequence builds note events');
  assert.strictEqual(mixSeq.events[0].volume, 1, 'MelSound sequence defaults track volume to 1');

  assert.strictEqual(mixProject.setTrackMute(mixTrack.id, true), true, 'MelSound setTrackMute stores mute');
  const mutedSeq = buildSequence(mixProject);
  assert.strictEqual(mutedSeq.events.length, 0, 'MelSound sequence skips muted tracks');

  const quietVol = mixProject.setTrackVolume(mixTrack.id, 0.5);
  assert.strictEqual(quietVol, 0.5, 'MelSound setTrackVolume stores volume');
  const quietSeq = buildSequence(mixProject);
  assert.strictEqual(quietSeq.events.length, 0, 'MelSound sequence still skips muted track after unmute check');
  mixProject.setTrackMute(mixTrack.id, false);
  const quietSeq2 = buildSequence(mixProject);
  assert.ok(Math.abs(quietSeq2.events[0].volume - 0.5) < 1e-9, 'MelSound sequence carries track volume');

  const swingProject = new MelSoundProject({ bpm: 140 });
  const swingTrack = swingProject.addTrack('Lead');
  swingProject.setStep(swingTrack.id, 1, 62);
  const straightSeq = buildSequence(swingProject);
  assert.ok(Math.abs(straightSeq.events[0].time - (1 * 60) / (140 * 4)) < 1e-9, 'MelSound swing neutral at zero');
  swingProject.swing = 0.5;
  const swungSeq = buildSequence(swingProject);
  assert.ok(Math.abs(swungSeq.events[0].time - (1.5 * 60) / (140 * 4)) < 1e-9, 'MelSound swing delays offbeat steps');

  console.log('✓ MelSound audio sequence builder validated');

  // 4b. Test MelSound song assembly from pattern chain (FL Studio playlist)
  const songProject = new MelSoundProject({ bpm: 140 });
  const bassTrack = songProject.addTrack('Bassline');
  const leadTrack = songProject.addTrack('Lead');
  const verse = songProject.addPattern('Verse');
  const chorus = songProject.addPattern('Chorus');
  assert.strictEqual(songProject.addPatternToChain(verse.id), true, 'MelSound addPatternToChain appends');
  assert.strictEqual(songProject.addPatternToChain(chorus.id), true, 'MelSound addPatternToChain appends second');
  songProject.setStepOnPattern(verse.id, bassTrack.id, 0, 40);
  songProject.setStepOnPattern(verse.id, bassTrack.id, 4, 43);
  songProject.setStepOnPattern(chorus.id, bassTrack.id, 0, 47);
  songProject.setStepOnPattern(chorus.id, leadTrack.id, 8, 62);
  const songSeq = buildSequence(songProject);
  assert.strictEqual(songSeq.patternCount, 2, 'MelSound song sequence counts chain patterns');
  assert.strictEqual(songSeq.events.length, 4, 'MelSound song sequence gathers chain events');
  assert.ok(Math.abs(songSeq.events[0].time - (0 * 60) / (140 * 4)) < 1e-9, 'MelSound song event time pattern 1 starts at zero');
  assert.ok(Math.abs(songSeq.events[1].time - (4 * 60) / (140 * 4)) < 1e-9, 'MelSound song event time pattern 1 step 4');
  assert.ok(Math.abs(songSeq.events[2].time - (16 * 60) / (140 * 4)) < 1e-9, 'MelSound song event time pattern 2 offset by one bar');
  assert.ok(Math.abs(songSeq.events[3].time - (24 * 60) / (140 * 4)) < 1e-9, 'MelSound song event time pattern 2 step 8');

  const emptySong = new MelSoundProject({ bpm: 140 });
  assert.strictEqual(buildSequence(emptySong).patternCount, 1, 'MelSound sequence single pass without chain');

  console.log('✓ MelSound song assembly from pattern chain validated');

  // 5. Test MelSound WAV export (16-bit PCM render of the sequence)
  const { renderSequenceWav, saveWav } = require('./src/wav');
  const wavBuf = renderSequenceWav(mixProject, 44100);
  assert.strictEqual(wavBuf.toString('ascii', 0, 4), 'RIFF', 'MelSound WAV export writes RIFF header');
  assert.strictEqual(wavBuf.toString('ascii', 8, 12), 'WAVE', 'MelSound WAV export writes WAVE tag');
  const dataSize = wavBuf.readUInt32LE(40);
  assert.ok(dataSize > 0, 'MelSound WAV export data chunk size positive');
  assert.strictEqual(wavBuf.length, 44 + dataSize, 'MelSound WAV export size exact');
  const wavOutPath = path.join(os.tmpdir(), 'mel-sound-export.wav');
  const wavWritten = saveWav(mixProject, wavOutPath, 44100);
  assert.ok(fs.existsSync(wavOutPath) && fs.statSync(wavOutPath).size > 44, 'MelSound WAV save writes file');
  assert.strictEqual(wavWritten.length, wavBuf.length, 'MelSound WAV save returns same buffer');
  console.log('✓ MelSound WAV export validated');

  console.log('\nALL MELSOUND TESTS PASSED SUCCESSFULLY!\n');
}

runTests();
